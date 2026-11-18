import { domAnimation, LazyMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { productImageSources } from '../../services/productImages.js';
import useReducedMotion from '../../hooks/useReducedMotion.js';

export default function BuildKitPreview({ slots }) {
  const reducedMotion = useReducedMotion();
  const PreviewImage = reducedMotion ? 'img' : m.img;
  return (
    <LazyMotion features={domAnimation} strict>
      <section className="build-kit-preview" aria-label="Vista de tu selección">
        <span className="build-preview-orbit" aria-hidden="true" />
        <ul>
          {slots.map(({ label, product }, index) => (
            <li key={label} data-filled={Boolean(product)}>
              <span className="build-preview-index" aria-hidden="true">
                0{index + 1}
              </span>
              {product ? (
                <PreviewImage
                  key={product._id}
                  {...productImageSources(product.image)}
                  {...(!reducedMotion && {
                    initial: { opacity: 0.45, y: 8, scale: 0.96 },
                    animate: { opacity: 1, y: 0, scale: 1 },
                    transition: { duration: 0.25, ease: 'easeOut' },
                  })}
                  width={80}
                  height={72}
                  alt={product.name}
                />
              ) : (
                <span className="build-preview-placeholder" aria-hidden="true">
                  +
                </span>
              )}
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <p>Vista de selección · no certifica compatibilidad.</p>
      </section>
    </LazyMotion>
  );
}
