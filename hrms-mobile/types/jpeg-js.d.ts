declare module 'jpeg-js' {
  const jpeg: {
    decode: (
      buffer: Uint8Array,
      options?: { useTArray?: boolean }
    ) => { width: number; height: number; data: Uint8Array };
  };
  export default jpeg;
}
