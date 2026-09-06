import type { Address } from "viem";

export interface UniswapQuote {
  chainId: number;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  amountOut: string;
  route: { type: string; address: string }[];
  priceImpact?: number;
  gasFeeUsd?: string;
  requestId?: string;
  fetchedAt: number;
}

interface TradingApiQuote {
  requestId?: string;
  routing?: string;
  quote?: {
    input?: { amount?: string };
    output?: { amount?: string };
    route?: { type: string; address: string }[][];
    priceImpact?: number;
    gasFeeUSD?: string;
  };
  errorCode?: string;
  detail?: string;
}

/// Quotes through Uniswap's Trading API with a short cache, so the widget can show a live pool price without holding the key.
export class UniswapQuoter {
  private readonly cache = new Map<string, UniswapQuote>();

  constructor(
    private readonly apiKey: string,
    private readonly swapper: Address,
    private readonly baseUrl = "https://trade-api.gateway.uniswap.org/v1",
    private readonly ttlMs = 15_000,
  ) {}

  async quote(chainId: number, tokenIn: Address, tokenOut: Address, amount: bigint): Promise<UniswapQuote> {
    const key = `${chainId}:${tokenIn}:${tokenOut}:${amount}`.toLowerCase();
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < this.ttlMs) return cached;

    const response = await fetch(`${this.baseUrl}/quote`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify({
        tokenInChainId: chainId,
        tokenOutChainId: chainId,
        tokenIn,
        tokenOut,
        amount: amount.toString(),
        type: "EXACT_INPUT",
        swapper: this.swapper,
        protocols: ["V4", "V3", "V2"],
        slippageTolerance: 0.5,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json()) as TradingApiQuote;
    if (!response.ok || !body.quote?.output?.amount) {
      throw new Error(`Uniswap Trading API ${response.status}: ${body.detail ?? body.errorCode ?? "no quote"}`);
    }
    const result: UniswapQuote = {
      chainId,
      tokenIn,
      tokenOut,
      amountIn: body.quote.input?.amount ?? amount.toString(),
      amountOut: body.quote.output.amount,
      route: (body.quote.route ?? []).flat().map((hop) => ({ type: hop.type, address: hop.address })),
      priceImpact: body.quote.priceImpact,
      gasFeeUsd: body.quote.gasFeeUSD,
      requestId: body.requestId,
      fetchedAt: Date.now(),
    };
    this.cache.set(key, result);
    return result;
  }
}
