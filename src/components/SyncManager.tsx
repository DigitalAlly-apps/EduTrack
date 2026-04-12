import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { pushUserData, pullUserData } from '@/lib/supabase';
import { getData, saveData } from '@/lib/data';

export default function SyncManager() {
  const { user, membershipStatus } = useAuth();

  useEffect(() => {
    if (!user || membershipStatus === 'free') return;

    // 1. Initial Pull on login
    const doInitialSync = async () => {
      const cloudData = await pullUserData(user.id);
      if (cloudData && Object.keys(cloudData).length > 0) {
        // Merge cloud data over local (cloud wins)
        const local = getData();
        saveData({ ...local, ...cloudData });
        console.info('[EduTrack Sync] Cloud data restored.');
      }
    };

    doInitialSync();
  }, [user, membershipStatus]);

  // 2. Push on data changes (debounced 2s)
  useEffect(() => {
    if (!user || membershipStatus === 'free') return;

    const timeout = setTimeout(async () => {
      const data = getData();
      await pushUserData(user.id, data);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [user, membershipStatus]);

  return null;
}
