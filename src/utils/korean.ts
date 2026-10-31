// 마지막 글자의 받침 유무에 따라 조사만 반환 (한글이 아니면 받침 없음으로 취급)
// 예) `'${name}'${josa(name, '을/를')}` → '오이'를, '굴'을
export const josa = (word: string, pair: '이/가' | '은/는' | '을/를') => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasFinalConsonant = code >= 0 && code <= 11171 && code % 28 !== 0;
  const [withBatchim, withoutBatchim] = pair.split('/');
  return hasFinalConsonant ? withBatchim : withoutBatchim;
};
