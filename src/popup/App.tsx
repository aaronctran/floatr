import { useState, useEffect } from 'react';
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MainScreen from './screens/MainScreen';

export default function App() {
  const [screen, setScreen] = useState<'loading' | 'login' | 'onboarding' | 'main'>('loading');

  useEffect(() => {
    chrome.storage.local.get(['onboarded'], (result) => {
      if (result.onboarded) {
        setScreen('main');
      } else {
        setScreen('login');
      }
    });
  }, []);

  if (screen === 'loading') {
    return (
      <div className="w-[420px] min-h-[540px] bg-bg-primary flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading…</div>
      </div>
    );
  }

  if (screen === 'login') {
    return <LoginScreen onContinue={() => setScreen('onboarding')} />;
  }

  if (screen === 'onboarding') {
    return <OnboardingScreen onComplete={() => setScreen('main')} />;
  }

  return <MainScreen />;
}
