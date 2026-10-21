import AiAssistant from './AiAssistant.jsx';
import { BlogSection, TestimonialsSection } from './EditorialSections.jsx';
import { ContactSection, NewsletterSection } from './FormsSections.jsx';
import { useEffect } from 'react';

export default function HomeBelowFold({ user }) {
  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (target === 'ai-assistant' || target === 'contacto')
      document.getElementById(target)?.scrollIntoView();
  }, []);

  return (
    <>
      <AiAssistant key={user?.id || user?._id || user?.email || 'guest'} user={user} />
      <BlogSection />
      <TestimonialsSection />
      <NewsletterSection />
      <ContactSection />
    </>
  );
}
