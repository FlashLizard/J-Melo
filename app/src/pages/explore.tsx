import AppPageShell from '@/components/common/AppPageShell';
import ExploreView from '@/components/explore/ExploreView';
import useTranslation from '@/hooks/useTranslation';
import useSongStore from '@/stores/useSongStore';
import useVocabularyStore from '@/stores/useVocabularyStore';

const ExplorePage = () => {
  const { t } = useTranslation();
  const { fetchAllSongs } = useSongStore();
  const { loadWordsAndSongs } = useVocabularyStore();

  return (
    <AppPageShell
      title={t('home.exploreTab') || '探索'}
      documentTitle={`J-Melo - ${t('home.exploreTab') || t('home.title')}`}
      maxWidth="max-w-7xl"
      backLabel={t('common.back') || t('settings.backToPlayer')}
    >
      <ExploreView onImportSuccess={() => { fetchAllSongs(); loadWordsAndSongs(); }} />
    </AppPageShell>
  );
};

export default ExplorePage;
