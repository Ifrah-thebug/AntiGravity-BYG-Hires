import { useCallback, useEffect, useState } from 'react';
import { fetchTalentPortfolioSharing } from '@/features/portfolio/api/portfolioAccessApi';
import { buildPortfolioShareUrl } from '@/shared/lib/portfolioShareUrl';

const DEFAULT_SHARING = { portfolioPublicEnabled: true, shareToken: '', directoryStatus: null };

/** Talent's public/private portfolio link settings + the URL to share. */
export function usePortfolioSharing(profileId) {
  const [settings, setSettings] = useState(DEFAULT_SHARING);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const data = await fetchTalentPortfolioSharing();
      setSettings({
        portfolioPublicEnabled: data.portfolioPublicEnabled !== false,
        shareToken: data.shareToken || '',
        directoryStatus: data.directoryStatus || null,
      });
    } catch {
      setSettings(DEFAULT_SHARING);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const shareUrl = buildPortfolioShareUrl({
    profileId,
    portfolioPublicEnabled: settings.portfolioPublicEnabled,
    shareToken: settings.shareToken,
  });

  return { settings, setSettings, loading, reload, shareUrl };
}
