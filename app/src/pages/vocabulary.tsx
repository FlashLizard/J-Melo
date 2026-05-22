import { useRouter } from 'next/router';
import { useEffect } from 'react';

import AppPageShell from '@/components/common/AppPageShell';
import VocabularyView from '@/components/vocabulary/VocabularyView';
import useTranslation from '@/hooks/useTranslation';
import useVocabularyStore from '@/stores/useVocabularyStore';

const VocabularyPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { isReviewing, loadWordsAndSongs } = useVocabularyStore();

  useEffect(() => {
    loadWordsAndSongs();
  }, [loadWordsAndSongs]);

  useEffect(() => {
    if (!isReviewing && router.query.returnToPlayer) {
      router.replace(`/player/${router.query.returnToPlayer}`);
    }
  }, [isReviewing, router]);

  return (
    <AppPageShell
      title={t('vocabularyPage.title')}
      documentTitle={`J-Melo - ${t('vocabularyPage.title')}`}
      maxWidth="max-w-5xl"
      containerClassName="flex flex-col h-[calc(100vh-2rem)] lg:h-[calc(100vh-4rem)]"
      backLabel={t('vocabularyPage.backToPlayer')}
    >
      <VocabularyView />
    </AppPageShell>
  );
};

export default VocabularyPage;
