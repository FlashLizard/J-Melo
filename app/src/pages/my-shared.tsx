import Head from 'next/head';
import { useRouter } from 'next/router';

import MySharedPanel from '@/components/explore/MySharedPanel';
import useTranslation from '@/hooks/useTranslation';

const MySharedPage = () => {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <>
      <Head>
        <title>{`J-Melo - ${t('home.mySharedButton')}`}</title>
      </Head>
      <main className="jm-page min-h-screen">
        <MySharedPanel onClose={() => router.push('/')} />
      </main>
    </>
  );
};

export default MySharedPage;
