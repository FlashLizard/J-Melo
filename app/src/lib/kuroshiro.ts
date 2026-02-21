// app/src/lib/kuroshiro.ts
import Kuroshiro from 'kuroshiro';
// @ts-ignore
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';

class KuroshiroManager {
  private static instance: Promise<Kuroshiro> | null = null;

  public static getInstance(): Promise<Kuroshiro> {
    if (!KuroshiroManager.instance) {
      const kuroshiro = new Kuroshiro();
      KuroshiroManager.instance = kuroshiro.init(new KuromojiAnalyzer({ dictPath: '/dict' }))
        .then(() => kuroshiro)
        .catch(err => {
          console.error("Failed to initialize Kuroshiro", err);
          // Prevent future attempts if initialization fails
          KuroshiroManager.instance = null;
          throw err; // Re-throw to allow callers to handle the error
        });
    }
    return KuroshiroManager.instance;
  }
}

export default KuroshiroManager;
