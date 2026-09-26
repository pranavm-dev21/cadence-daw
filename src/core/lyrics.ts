/** Small offline writing aid, deliberately labelled approximate in the UI. */
const rhymeFamilies = [
  ['night','light','bright','tight','sight','flight','write'], ['time','rhyme','climb','chime','prime'],
  ['flow','glow','show','grow','know','slow'], ['day','play','stay','way','say'],
  ['fire','higher','desire','wire'], ['sound','ground','round','found','bound'],
];
export function analyzeLyrics(text: string) {
  const words = text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
  const counts = new Map<string, number>(); for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  const repeated = [...counts].filter(([word, count]) => count > 1 && word.length > 2).sort((a,b) => b[1] - a[1]).slice(0,8);
  const lastWord = words[words.length - 1] ?? '';
  const rhymes = (rhymeFamilies.find(family => family.includes(lastWord)) ?? []).filter(word => word !== lastWord);
  const lines = text.split('\n').filter(line => line.trim()).slice(0,64).map(line => {
    const lineWords = line.toLowerCase().match(/[a-z]+/g) ?? [];
    const syllables = lineWords.reduce((sum, word) => sum + Math.max(1, (word.replace(/e$/, '').match(/[aeiouy]+/g) ?? []).length), 0);
    return { text: line, syllables };
  });
  return { wordCount: words.length, repeated, lastWord, rhymes, lines };
}

