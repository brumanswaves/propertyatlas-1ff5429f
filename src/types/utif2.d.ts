declare module "utif2" {
  interface Ifd {
    t256?: number[];
    t257?: number[];
    t258?: number[];
    t277?: number[];
    [key: string]: unknown;
  }
  const UTIF: {
    decode(buffer: ArrayBuffer): Ifd[];
    decodeImage(buffer: ArrayBuffer, ifd: Ifd): void;
    toRGBA8(ifd: Ifd): Uint8Array;
  };
  export default UTIF;
}
