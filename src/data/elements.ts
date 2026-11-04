import type { Element } from '../core/types';

export interface ElementInfo {
  id: Element;
  name: string;
  color: string;
  /** 戦闘での役割の説明 */
  role: string;
}

export const ELEMENTS: Record<Element, ElementInfo> = {
  neutral: { id: 'neutral', name: 'ふつう', color: '#a9a192', role: 'くせがなく、どんな相手にも安定して戦える。' },
  blaze: { id: 'blaze', name: 'ほむら', color: '#ef6a3a', role: '高い攻撃力で押し切る。やけどで相手の物理攻撃を弱める。' },
  tide: { id: 'tide', name: 'しお', color: '#3a8fe0', role: '攻守のバランスがよく、回復技を持つものが多い。' },
  sprout: { id: 'sprout', name: 'めぶき', color: '#4cae4f', role: 'HPを吸い取る技や、ねむり・どくで粘り強く戦う。' },
  volt: { id: 'volt', name: 'いかずち', color: '#e8c12c', role: '素早さが高い。まひで相手の動きを止める。' },
  stone: { id: 'stone', name: 'いわお', color: '#a07a4e', role: '防御が固い。ほむら・いかずちの攻撃を受け止める壁役。' },
  gale: { id: 'gale', name: 'はやて', color: '#5cc7b8', role: '素早く、能力を上げてから攻める。いわおに強い。' },
  shine: { id: 'shine', name: 'ひかり', color: '#f3d36b', role: '回復と補助が得意。かげと互いに弱点を突き合う。' },
  shade: { id: 'shade', name: 'かげ', color: '#7b5ea8', role: 'かすみ・命中低下で相手を惑わす。ひかりと互いに弱点を突き合う。' },
};

export const ELEMENT_ORDER: Element[] = ['neutral', 'blaze', 'tide', 'sprout', 'volt', 'stone', 'gale', 'shine', 'shade'];

/**
 * 相性表 CHART[攻撃側][防御側] = 倍率。書いていない組み合わせは 1 倍。
 * 無効（0倍）は作らない。どの組み合わせでも技や交代で逆転できる余地を残すため。
 */
const CHART: Partial<Record<Element, Partial<Record<Element, number>>>> = {
  neutral: { stone: 0.5 },
  blaze: { sprout: 2, shade: 2, tide: 0.5, stone: 0.5, blaze: 0.5 },
  tide: { blaze: 2, stone: 2, sprout: 0.5, volt: 0.5, tide: 0.5 },
  sprout: { tide: 2, stone: 2, blaze: 0.5, gale: 0.5, sprout: 0.5 },
  volt: { tide: 2, gale: 2, stone: 0.5, sprout: 0.5, volt: 0.5 },
  stone: { volt: 2, blaze: 2, gale: 0.5, sprout: 0.5 },
  gale: { sprout: 2, stone: 2, volt: 0.5 },
  shine: { shade: 2, shine: 0.5 },
  shade: { shine: 2, shade: 0.5 },
};

export function effectiveness(attack: Element, defenders: readonly Element[]): number {
  let m = 1;
  for (const d of defenders) m *= CHART[attack]?.[d] ?? 1;
  return m;
}

export const STAB = 1.25;
