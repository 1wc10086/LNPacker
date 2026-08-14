declare module 'fast-gbk' {
  type Gbk = { decode(data: ArrayLike<number>): string };
  function createGbk(): Gbk;
  export default createGbk;
}
