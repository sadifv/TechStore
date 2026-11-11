import AiAssistant from '../assistant/AiAssistant.jsx';
import { ContactSection, NewsletterSection } from './FormsSections.jsx';
import { useEffect } from 'react';
import BuildExperience from './BuildExperience.jsx';

export default function HomeBelowFold({ user }) {
  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (target === 'ai-assistant' || target === 'contacto')
      document.getElementById(target)?.scrollIntoView();
  }, []);

  return (
    <>
      <BuildExperience />
      <AiAssistant key={user?.id || user?._id || user?.email || 'guest'} user={user} />
      <NewsletterSection />
      <ContactSection />
    </>
  );
}
