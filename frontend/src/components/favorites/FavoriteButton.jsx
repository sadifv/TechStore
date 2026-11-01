import { useState } from 'react';
import { useFavorites } from './FavoritesContext.js';
export default function FavoriteButton({ product }) {
  const favorites = useFavorites();
  const [error, setError] = useState('');
  if (!favorites?.user)
    return (
      <a
        className="btn btn-outline"
        href={`/login?next=${encodeURIComponent(`/producto/${product._id}`)}`}
      >
        Inicia sesión para guardar
      </a>
    );
  const saved = favorites.ids.includes(String(product._id));
  return (
    <section aria-label={`Favorito: ${product.name}`}>
      <button
        type="button"
        className="btn btn-outline"
        aria-pressed={saved}
        disabled={
          favorites.loading ||
          favorites.busy.includes(String(product._id)) ||
          Boolean(favorites.error)
        }
        onClick={async () => {
          setError('');
          try {
            await favorites.toggle(product);
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        {saved ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      </button>
      {(error || favorites.error) && (
        <p role="alert" className="form-status error">
          {error || favorites.error}
        </p>
      )}
      {favorites.error && (
        <button type="button" className="btn btn-outline" onClick={favorites.refresh}>
          Reintentar favoritos
        </button>
      )}
    </section>
  );
}
