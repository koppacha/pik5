
// 指定値から指定値までの数列を作成する関数
export const range = (start, end) => [...Array((end - start) + 1)].map((_, i) => start + i);
