import { createRoot } from 'react-dom/client';
import SplitText from '../components/ui/split-text';

document.querySelectorAll<HTMLElement>('[data-section-title]').forEach(mount => {
  createRoot(mount).render(
    <SplitText tag="span" text={mount.textContent?.trim() ?? ''} className="pb-[0.12em]" textAlign="left"
      effect="rise" splitType="chars" delay={50} duration={1.25} staggerFrom="start" trigger="view" hoverEffect="lift" />
  );
});
