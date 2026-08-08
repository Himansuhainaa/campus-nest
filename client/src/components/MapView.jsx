import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { formatRent, bedroomLabel } from './ListingCard';
import StarRating from './StarRating';

/**
 * A divIcon rather than Leaflet's default PNG marker: it matches the site's
 * colours and avoids the bundler/marker-image dance entirely.
 */
const pinIcon = L.divIcon({
  className: 'cn-pin',
  iconSize: [30, 40],
  iconAnchor: [15, 38],
  popupAnchor: [0, -34],
  html: `
    <svg viewBox="0 0 30 40" width="30" height="40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 39c0 0-13-14.2-13-23.2A13 13 0 0 1 28 15.8C28 24.8 15 39 15 39Z"
            fill="#236b68" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="15" cy="15.5" r="5" fill="#ffffff"/>
    </svg>`,
});

const hasCoords = (l) => typeof l?.lat === 'number' && typeof l?.lng === 'number';

/** Keeps every pin in frame, and fixes tile layout when the container appears. */
function FitToMarkers({ points, singleZoom }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');

  useEffect(() => {
    // The container may have been sized after Leaflet measured it (e.g. when the
    // map/grid toggle swaps views) — remeasure before fitting.
    map.invalidateSize();

    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], singleZoom);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, singleZoom]);

  return null;
}

/**
 * OpenStreetMap tiles — no API key, no billing. Renders only listings that have
 * coordinates; the caller decides what to say about the ones that don't.
 */
export default function MapView({
  listings = [],
  className = '',
  height = '540px',
  singleZoom = 15,
}) {
  const mappable = useMemo(() => listings.filter(hasCoords), [listings]);
  const points = useMemo(() => mappable.map((l) => [l.lat, l.lng]), [mappable]);

  if (!mappable.length) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed
                    border-slate-300 bg-white p-10 text-center ${className}`}
        style={{ height }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10 text-slate-300">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75 3.75 4.5v12.75L9 19.5m0-12.75 6 2.25m-6-2.25V19.5m6-10.5 5.25-2.25V19.5L15 21.75m0-12.75V21.75M9 19.5l6 2.25" />
        </svg>
        <p className="font-medium text-slate-700">Nothing to map yet</p>
        <p className="max-w-xs text-sm text-slate-500">
          None of these listings have coordinates. Add latitude and longitude when
          you post a place and it will show up here.
        </p>
      </div>
    );
  }

  const center = points[0];

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 shadow-card ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={mappable.length === 1 ? singleZoom : 13}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitToMarkers points={points} singleZoom={singleZoom} />

        {mappable.map((listing) => {
          const id = listing._id || listing.id;
          const summary = listing.ratingSummary;
          return (
            <Marker key={id} position={[listing.lat, listing.lng]} icon={pinIcon}>
              <Popup>
                <div className="w-52">
                  <Link
                    to={`/listings/${id}`}
                    className="block font-semibold leading-snug text-brand-700 hover:underline"
                  >
                    {listing.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">{listing.address}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      {formatRent(listing.rentPerMonth)}/mo
                    </span>
                    <span className="text-slate-500">{bedroomLabel(listing.bedrooms)}</span>
                  </div>
                  {summary?.count > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <StarRating value={summary.overall} size="xs" />
                      <span className="text-xs font-semibold text-slate-700">
                        {summary.overall.toFixed(1)}
                      </span>
                      <span className="text-xs text-slate-500">({summary.count})</span>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
