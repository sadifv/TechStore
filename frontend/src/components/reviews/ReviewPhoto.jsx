import { apiUrl } from '../../services/api.js';
import './reviewPhoto.css';

export default function ReviewPhoto({ url, alt }) {
  if (!url) return null;
  const source = apiUrl(url);
  return (
    <a className="review-photo" href={source} target="_blank" rel="noreferrer">
      <img src={source} alt={alt} width="192" height="144" loading="lazy" />
    </a>
  );
}
