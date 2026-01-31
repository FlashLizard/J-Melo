// src/pages/settings.tsx
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

const SettingsPage = () => {
  const settings = useLiveQuery(() => db.settings.get(0));
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (settings?.openaiApiKey) {
      setApiKey(settings.openaiApiKey);
    }
  }, [settings]);

  const handleSave = async () => {
    await db.settings.put({
      id: 0,
      openaiApiKey: apiKey,
      uiLanguage: 'en', // Default for now
    });
    alert('Settings saved!');
  };

  return (
    <>
      <Head>
        <title>Settings - J-Melo</title>
      </Head>
      <main className="bg-gray-900 min-h-screen text-white p-4 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Settings</h1>
            <Link href="/" className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500">
              Back to Player
            </Link>
          </div>

          <div className="space-y-6 bg-gray-800 p-6 rounded-lg">
            <div>
              <label htmlFor="apiKey" className="block text-lg font-medium mb-2">
                OpenAI API Key
              </label>
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="sk-..."
              />
              <p className="text-xs text-gray-400 mt-2">
                Your API key is stored locally in your browser's IndexedDB and is never sent to our servers.
              </p>
            </div>

            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 w-full"
            >
              Save Settings
            </button>
          </div>
        </div>
      </main>
    </>
  );
};

export default SettingsPage;
