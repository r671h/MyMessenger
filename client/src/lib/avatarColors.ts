const AVATAR_COLORS = [
  '#E17076', '#7BC862', '#65AADD', '#A695E7',
  '#EE7AAE', '#6EC9CB', '#FAA774', '#5D9BD4',
];
export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}