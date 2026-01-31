// src/lib/kuroshiro.ts
import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';

class KuroshiroManager {
  private static instance: Kuroshiro | null = null;
  private static analyzer: KuromojiAnalyzer | null = null;
  private static initializing: Promise<void> | null = null;

  private constructor() {}

  public static async getInstance(): Promise<Kuroshiro> {
    if (KuroshiroManager.instance) {
      return KuroshiroManager.instance;
    }

    if (!KuroshiroManager.initializing) {
      KuroshiroManager.initializing = (async () => {
        const kuroshiro = new Kuroshiro();
        const analyzer = new KuromojiAnalyzer({
          dictPath: '/dict', // Path relative to the public directory
        });
        await kuroshiro.init(analyzer);
        KuroshiroManager.instance = kuroshiro;
        KuroshiroManager.analyzer = analyzer;
      })();
    }

    await KuroshiroManager.initializing;
    return KuroshiroManager.instance!;
  }
}

export default KuroshiroManager;
