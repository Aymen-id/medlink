# Patient exports

The Node.js export endpoint authorizes the selected workspace via the user's RLS client, then downloads only those object paths using server Storage access. All downloads must succeed and match the recorded size before ZIP response headers are sent. A missing/changed object fails with 502; no partial archive is silently returned.

Downloads run with at most three workers and a 45-second preparation deadline. ZIP input uses Node Buffers. The output is a streaming, uncompressed ZIP with no-store headers, reducing response buffering and CPU. Vercel recommends streaming when the response exceeds its buffered 4.5 MB limit: https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions . The route selects Node.js and a 60-second maximum duration.

The synchronous path has a conservative 100 MiB / 500 document input ceiling. It rejects larger exports before downloading, and the patient page shows the error with individual downloads still available. This bounds server and browser memory; it is not a complete background export implementation. Supporting arbitrarily large patient archives requires a durable background job and private, expiring, reauthorized delivery. That remains a release limitation, not a claim of unlimited export support.

Tests unzip binary data byte-for-byte, reject partial failures, verify worker bounds, and exercise a representative 16 MiB archive. These are local synthetic measurements. Deployment-specific memory, total runtime, streaming delivery and slow/large Storage behavior remain hosted acceptance gates.
