// src/pages/vocabulary.tsx
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

const VocabularyPage = () => {
  const words = useLiveQuery(() => db.words.orderBy('createdAt').reverse().toArray());

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this word?')) {
      await db.words.delete(id);
    }
  };

  const handleExportCSV = () => {
    if (!words || words.length === 0) {
      alert("No words to export.");
      return;
    }

    const headers = ['Surface', 'Reading', 'Romaji', 'Definition', 'Source Song ID', 'Created At'];
    const csvContent = [
      headers.join(','),
      ...words.map(word => [
        `"${word.surface}"`,
        `"${word.reading}"`,
        `"${word.romaji}"`,
        `"${word.definition.replace(/"/g, '""')}"`, // Escape double quotes
        word.sourceSongId,
        word.createdAt.toISOString(),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8-sig;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'j-melo-vocabulary.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Head>
        <title>My Vocabulary - J-Melo</title>
      </Head>
      <main className="bg-gray-900 min-h-screen text-white p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">My Vocabulary</h1>
            <div>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-500 mr-4"
              >
                Export as CSV
              </button>
              <Link href="/" className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500">
                Back to Player
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            {words && words.length > 0 ? (
              words.map((word) => (
                <div key={word.id} className="bg-gray-800 p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-semibold">{word.surface}</h2>
                      <p className="text-gray-400 whitespace-pre-wrap mt-2">{word.definition}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(word.id!)}
                      className="text-red-500 hover:text-red-400 font-bold"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    Added on: {word.createdAt.toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-10">
                Your vocabulary list is empty. Add words from the player!
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
};

export default VocabularyPage;
