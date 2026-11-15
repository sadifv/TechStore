import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import {
  measurementPath,
  safeMeasurementEvent,
  safeMeasurementReferrer,
} from '../../utils/measurementPrivacy.js';

const beforeSend = (event) => safeMeasurementEvent(event, location.origin);

export default function StoreMeasurements() {
  const route = measurementPath(location.pathname);
  if (!route || !safeMeasurementReferrer(document.referrer, location.origin)) return null;
  return (
    <>
      <Analytics mode="production" debug={false} beforeSend={beforeSend} />
      <SpeedInsights
        debug={false}
        scriptSrc="/_vercel/speed-insights/script.js"
        route={route}
        beforeSend={beforeSend}
      />
    </>
  );
}
