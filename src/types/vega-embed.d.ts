/**
 * Minimal ambient declaration for vega-embed.
 *
 * The full type definitions ship with the vega-embed package.
 * This declaration satisfies the TypeScript compiler until the package
 * is present in node_modules. At runtime the dynamic import in StoryChart
 * resolves against the installed package.
 */
declare module "vega-embed" {
  export interface EmbedResult {
    view: {
      finalize(): void;
      [key: string]: unknown;
    };
    spec: object;
  }

  export interface EmbedOptions {
    renderer?: "svg" | "canvas";
    actions?: boolean | object;
    width?: number | "container";
    height?: number;
    config?: object;
    [key: string]: unknown;
  }

  /** Main embed function — attaches a Vega-Lite spec to a DOM element. */
  export default function vegaEmbed(
    el: HTMLElement | string,
    spec: object,
    opt?: EmbedOptions,
  ): Promise<EmbedResult>;
}
