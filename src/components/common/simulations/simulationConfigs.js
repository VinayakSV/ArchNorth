// Simulation configs for each system design topic
// Each config defines nodes, connections, and animated steps

export const rateLimiterSim = {
  title: 'Rate Limiter — Token Bucket in Action',
  description: 'Watch how a token bucket rate limiter allows or rejects requests',
  width: 580, height: 280,
  nodes: [
    { id: 'client', x: 80, y: 140, label: 'Client', icon: '👤' },
    { id: 'limiter', x: 290, y: 140, label: 'Rate Limiter', icon: '🪣' },
    { id: 'server', x: 500, y: 140, label: 'API Server', icon: '🖥️' },
    { id: 'bucket', x: 290, y: 50, label: 'Bucket: 5 tokens', icon: '🪙' },
  ],
  connections: [
    { id: 'c-l', from: 'client', to: 'limiter' },
    { id: 'l-s', from: 'limiter', to: 'server' },
    { id: 'b-l', from: 'bucket', to: 'limiter' },
  ],
  steps: [
    { description: '🪙 Bucket starts with 5 tokens. Each request consumes 1 token.', duration: 1800, nodeStates: { bucket: 'active', limiter: 'idle' } },
    { description: '📨 Request 1 arrives → Token consumed (4 left) → Request forwarded ✅', duration: 1500, packet: { from: 'client', to: 'limiter', label: 'REQ 1', color: '#4caf50' }, nodeStates: { client: 'active', limiter: 'active', bucket: 'active' }, activeConnections: ['c-l'] },
    { description: '✅ Request 1 reaches API server. Bucket: 4 tokens remaining.', duration: 1200, packet: { from: 'limiter', to: 'server', label: 'REQ 1', color: '#4caf50' }, nodeStates: { limiter: 'active', server: 'active' }, activeConnections: ['l-s'] },
    { description: '📨 Requests 2, 3, 4 arrive rapidly → All allowed (1 token left)', duration: 1500, packet: { from: 'client', to: 'limiter', label: 'REQ 2-4', color: '#4caf50' }, nodeStates: { client: 'active', limiter: 'active', bucket: 'warn' }, activeConnections: ['c-l', 'l-s'] },
    { description: '📨 Request 5 arrives → Last token consumed (0 left) → Allowed ✅', duration: 1500, packet: { from: 'client', to: 'limiter', label: 'REQ 5', color: '#ff9800' }, nodeStates: { client: 'active', limiter: 'warn', bucket: 'warn' }, activeConnections: ['c-l'] },
    { description: '🚫 Request 6 arrives → No tokens! → 429 Too Many Requests ❌', duration: 2000, packet: { from: 'client', to: 'limiter', label: 'REQ 6', color: '#f44336' }, nodeStates: { client: 'active', limiter: 'error', bucket: 'error' }, activeConnections: ['c-l'] },
    { description: '⏳ 1 second passes → Token refills (1 token) → Next request allowed', duration: 1800, nodeStates: { bucket: 'active', limiter: 'active' } },
    { description: '📨 Request 7 arrives → Token available → Allowed ✅', duration: 1500, packet: { from: 'client', to: 'server', label: 'REQ 7', color: '#4caf50' }, nodeStates: { client: 'active', limiter: 'active', server: 'active', bucket: 'active' }, activeConnections: ['c-l', 'l-s'] },
  ],
};

export const cdnSim = {
  title: 'CDN — Cache Hit vs Cache Miss',
  description: 'See how a CDN serves content from edge vs origin',
  width: 600, height: 300,
  nodes: [
    { id: 'user', x: 80, y: 150, label: 'User', icon: '👤' },
    { id: 'edge', x: 280, y: 80, label: 'CDN Edge', icon: '🌐' },
    { id: 'shield', x: 280, y: 220, label: 'Origin Shield', icon: '🛡️' },
    { id: 'origin', x: 500, y: 150, label: 'Origin Server', icon: '🖥️' },
  ],
  connections: [
    { id: 'u-e', from: 'user', to: 'edge' },
    { id: 'e-s', from: 'edge', to: 'shield' },
    { id: 's-o', from: 'shield', to: 'origin' },
  ],
  steps: [
    { description: '👤 User requests image.jpg from CDN', duration: 1500, packet: { from: 'user', to: 'edge', label: 'GET image.jpg', color: '#2196f3' }, nodeStates: { user: 'active' }, activeConnections: ['u-e'] },
    { description: '❌ Cache MISS at edge — first request for this file in this region', duration: 1500, nodeStates: { edge: 'warn' } },
    { description: '🛡️ Edge asks Origin Shield (mid-tier cache)', duration: 1500, packet: { from: 'edge', to: 'shield', label: 'GET image.jpg', color: '#ff9800' }, nodeStates: { edge: 'warn', shield: 'active' }, activeConnections: ['e-s'] },
    { description: '❌ Shield also misses — forwards to Origin Server', duration: 1500, packet: { from: 'shield', to: 'origin', label: 'GET image.jpg', color: '#f44336' }, nodeStates: { shield: 'warn', origin: 'active' }, activeConnections: ['s-o'] },
    { description: '✅ Origin returns file → Shield caches it → Edge caches it', duration: 1800, packet: { from: 'origin', to: 'edge', label: 'image.jpg', color: '#4caf50' }, nodeStates: { origin: 'active', shield: 'active', edge: 'active' }, activeConnections: ['s-o', 'e-s'] },
    { description: '✅ User receives file (slow first time ~200ms)', duration: 1200, packet: { from: 'edge', to: 'user', label: 'image.jpg', color: '#4caf50' }, nodeStates: { edge: 'active', user: 'active' }, activeConnections: ['u-e'] },
    { description: '👤 Second user requests same file...', duration: 1500, packet: { from: 'user', to: 'edge', label: 'GET image.jpg', color: '#2196f3' }, nodeStates: { user: 'active' }, activeConnections: ['u-e'] },
    { description: '⚡ Cache HIT at edge! Served instantly (~20ms) — no origin call!', duration: 1500, packet: { from: 'edge', to: 'user', label: 'image.jpg ⚡', color: '#4caf50' }, nodeStates: { edge: 'highlight', user: 'active' }, activeConnections: ['u-e'] },
  ],
};


export const loadBalancerSim = {
  title: 'Load Balancer — Round Robin Distribution',
  description: 'Watch requests get distributed across servers',
  width: 600, height: 300,
  nodes: [
    { id: 'users', x: 80, y: 150, label: 'Users', icon: '👥' },
    { id: 'lb', x: 280, y: 150, label: 'Load Balancer', icon: '⚖️' },
    { id: 's1', x: 500, y: 60, label: 'Server 1', icon: '🖥️' },
    { id: 's2', x: 500, y: 150, label: 'Server 2', icon: '🖥️' },
    { id: 's3', x: 500, y: 240, label: 'Server 3', icon: '🖥️' },
  ],
  connections: [
    { id: 'u-lb', from: 'users', to: 'lb' },
    { id: 'lb-s1', from: 'lb', to: 's1' },
    { id: 'lb-s2', from: 'lb', to: 's2' },
    { id: 'lb-s3', from: 'lb', to: 's3' },
  ],
  steps: [
    { description: '📨 Request 1 arrives at Load Balancer', duration: 1200, packet: { from: 'users', to: 'lb', label: 'REQ 1', color: '#2196f3' }, nodeStates: { users: 'active' }, activeConnections: ['u-lb'] },
    { description: '➡️ Round Robin → Route to Server 1', duration: 1200, packet: { from: 'lb', to: 's1', label: 'REQ 1', color: '#4caf50' }, nodeStates: { lb: 'active', s1: 'active' }, activeConnections: ['lb-s1'] },
    { description: '📨 Request 2 arrives at Load Balancer', duration: 1200, packet: { from: 'users', to: 'lb', label: 'REQ 2', color: '#2196f3' }, nodeStates: { users: 'active' }, activeConnections: ['u-lb'] },
    { description: '➡️ Round Robin → Route to Server 2', duration: 1200, packet: { from: 'lb', to: 's2', label: 'REQ 2', color: '#4caf50' }, nodeStates: { lb: 'active', s2: 'active' }, activeConnections: ['lb-s2'] },
    { description: '📨 Request 3 arrives at Load Balancer', duration: 1200, packet: { from: 'users', to: 'lb', label: 'REQ 3', color: '#2196f3' }, nodeStates: { users: 'active' }, activeConnections: ['u-lb'] },
    { description: '➡️ Round Robin → Route to Server 3', duration: 1200, packet: { from: 'lb', to: 's3', label: 'REQ 3', color: '#4caf50' }, nodeStates: { lb: 'active', s3: 'active' }, activeConnections: ['lb-s3'] },
    { description: '💀 Server 2 goes down! Health check fails.', duration: 1800, nodeStates: { s2: 'error', lb: 'warn' } },
    { description: '📨 Request 4 arrives → LB skips Server 2 → Routes to Server 1', duration: 1500, packet: { from: 'lb', to: 's1', label: 'REQ 4', color: '#4caf50' }, nodeStates: { lb: 'active', s1: 'active', s2: 'error' }, activeConnections: ['lb-s1'] },
    { description: '✅ Traffic flows to healthy servers only. Users never notice!', duration: 1500, nodeStates: { s1: 'active', s3: 'active', s2: 'error', lb: 'highlight' } },
  ],
};

export const rideSharingSim = {
  title: 'Uber — Ride Matching Flow',
  description: 'Watch how a rider gets matched with the nearest driver',
  width: 600, height: 300,
  nodes: [
    { id: 'rider', x: 80, y: 150, label: 'Rider', icon: '🧑' },
    { id: 'api', x: 250, y: 150, label: 'Ride Service', icon: '📡' },
    { id: 'match', x: 420, y: 70, label: 'Matching', icon: '🎯' },
    { id: 'loc', x: 420, y: 230, label: 'Location Svc', icon: '📍' },
    { id: 'driver', x: 560, y: 150, label: 'Driver', icon: '🚗' },
  ],
  connections: [
    { id: 'r-a', from: 'rider', to: 'api' },
    { id: 'a-m', from: 'api', to: 'match' },
    { id: 'a-l', from: 'api', to: 'loc' },
    { id: 'm-d', from: 'match', to: 'driver' },
  ],
  steps: [
    { description: '🧑 Rider requests a ride from Location A to B', duration: 1500, packet: { from: 'rider', to: 'api', label: 'Book Ride', color: '#2196f3' }, nodeStates: { rider: 'active' }, activeConnections: ['r-a'] },
    { description: '📍 Location Service finds nearby drivers using QuadTree/Geohash', duration: 1500, packet: { from: 'api', to: 'loc', label: 'Find drivers', color: '#ff9800' }, nodeStates: { api: 'active', loc: 'active' }, activeConnections: ['a-l'] },
    { description: '📍 Found 3 drivers within 3km radius', duration: 1200, nodeStates: { loc: 'highlight' } },
    { description: '🎯 Matching Service calculates ETA for each driver', duration: 1500, packet: { from: 'api', to: 'match', label: 'Rank drivers', color: '#9c27b0' }, nodeStates: { api: 'active', match: 'active' }, activeConnections: ['a-m'] },
    { description: '🎯 Best match: Driver C (ETA 3 min, rating 4.8, heading toward rider)', duration: 1500, nodeStates: { match: 'highlight' } },
    { description: '🚗 Ride request sent to Driver C', duration: 1500, packet: { from: 'match', to: 'driver', label: 'Ride offer', color: '#4caf50' }, nodeStates: { match: 'active', driver: 'active' }, activeConnections: ['m-d'] },
    { description: '✅ Driver accepts! Rider notified. ETA: 3 minutes.', duration: 1800, packet: { from: 'api', to: 'rider', label: 'Driver assigned!', color: '#4caf50' }, nodeStates: { rider: 'highlight', driver: 'highlight', api: 'active' }, activeConnections: ['r-a'] },
  ],
};


export const atmSim = {
  title: 'ATM — Withdrawal Transaction Flow',
  description: 'Watch a complete ATM withdrawal with safety checks',
  width: 600, height: 280,
  nodes: [
    { id: 'user', x: 70, y: 140, label: 'User', icon: '👤' },
    { id: 'atm', x: 230, y: 140, label: 'ATM', icon: '🏧' },
    { id: 'bank', x: 420, y: 80, label: 'Bank Server', icon: '🏦' },
    { id: 'db', x: 420, y: 210, label: 'Account DB', icon: '💾' },
    { id: 'cash', x: 560, y: 140, label: 'Dispenser', icon: '💵' },
  ],
  connections: [
    { id: 'u-a', from: 'user', to: 'atm' },
    { id: 'a-b', from: 'atm', to: 'bank' },
    { id: 'b-d', from: 'bank', to: 'db' },
    { id: 'a-c', from: 'atm', to: 'cash' },
  ],
  steps: [
    { description: '💳 User inserts card and enters PIN', duration: 1500, nodeStates: { user: 'active', atm: 'active' }, activeConnections: ['u-a'] },
    { description: '🔐 ATM sends encrypted PIN to Bank for verification', duration: 1500, packet: { from: 'atm', to: 'bank', label: 'Verify PIN', color: '#2196f3' }, nodeStates: { atm: 'active', bank: 'active' }, activeConnections: ['a-b'] },
    { description: '✅ PIN verified! User selects Withdraw ₹5,000', duration: 1200, nodeStates: { bank: 'highlight', atm: 'active' } },
    { description: '🏦 Bank checks balance: ₹25,000 available', duration: 1500, packet: { from: 'bank', to: 'db', label: 'Check balance', color: '#ff9800' }, nodeStates: { bank: 'active', db: 'active' }, activeConnections: ['b-d'] },
    { description: '💰 Balance sufficient → Deduct ₹5,000 (PENDING state)', duration: 1500, packet: { from: 'db', to: 'bank', label: 'Deducted', color: '#4caf50' }, nodeStates: { db: 'warn', bank: 'active' }, activeConnections: ['b-d'] },
    { description: '💵 ATM dispenses cash — counting notes...', duration: 2000, packet: { from: 'atm', to: 'cash', label: 'Dispense', color: '#4caf50' }, nodeStates: { atm: 'active', cash: 'active' }, activeConnections: ['a-c'] },
    { description: '✅ Cash dispensed! Transaction marked COMPLETED', duration: 1500, packet: { from: 'atm', to: 'bank', label: 'Confirm', color: '#4caf50' }, nodeStates: { cash: 'highlight', bank: 'highlight', atm: 'highlight' }, activeConnections: ['a-b'] },
    { description: '🧾 Receipt printed. Card ejected. New balance: ₹20,000', duration: 1500, nodeStates: { user: 'highlight', atm: 'active' } },
  ],
};

export const netflixSim = {
  title: 'Netflix — Adaptive Bitrate Streaming',
  description: 'Watch how Netflix adjusts video quality based on bandwidth',
  width: 600, height: 280,
  nodes: [
    { id: 'player', x: 80, y: 140, label: 'Player', icon: '📱' },
    { id: 'cdn', x: 300, y: 80, label: 'CDN Edge', icon: '🌐' },
    { id: 'origin', x: 300, y: 220, label: 'Origin (S3)', icon: '☁️' },
    { id: 'screen', x: 520, y: 140, label: 'Screen', icon: '🖥️' },
  ],
  connections: [
    { id: 'p-c', from: 'player', to: 'cdn' },
    { id: 'c-o', from: 'cdn', to: 'origin' },
    { id: 'p-s', from: 'player', to: 'screen' },
  ],
  steps: [
    { description: '▶️ User presses Play — player requests manifest (chunk list)', duration: 1500, packet: { from: 'player', to: 'cdn', label: 'manifest', color: '#2196f3' }, nodeStates: { player: 'active' }, activeConnections: ['p-c'] },
    { description: '📋 Manifest received — lists chunks in 360p, 720p, 1080p, 4K', duration: 1200, nodeStates: { cdn: 'active', player: 'active' } },
    { description: '🎬 Start with 480p (fast start, small chunk)', duration: 1500, packet: { from: 'cdn', to: 'player', label: '480p chunk', color: '#ff9800' }, nodeStates: { cdn: 'active', player: 'active' }, activeConnections: ['p-c'] },
    { description: '📺 Playing at 480p — measuring bandwidth: 8 Mbps ✅', duration: 1500, packet: { from: 'player', to: 'screen', label: '480p', color: '#ff9800' }, nodeStates: { player: 'active', screen: 'active' }, activeConnections: ['p-s'] },
    { description: '⬆️ Bandwidth good! Upgrade to 1080p for next chunk', duration: 1500, packet: { from: 'cdn', to: 'player', label: '1080p chunk', color: '#4caf50' }, nodeStates: { cdn: 'highlight', player: 'active' }, activeConnections: ['p-c'] },
    { description: '📺 Now playing at 1080p — crystal clear!', duration: 1500, packet: { from: 'player', to: 'screen', label: '1080p ✨', color: '#4caf50' }, nodeStates: { screen: 'highlight' }, activeConnections: ['p-s'] },
    { description: '📉 Bandwidth drops to 2 Mbps (user on train)', duration: 1500, nodeStates: { player: 'warn', cdn: 'warn' } },
    { description: '⬇️ Auto-downgrade to 480p — no buffering!', duration: 1500, packet: { from: 'cdn', to: 'player', label: '480p chunk', color: '#ff9800' }, nodeStates: { cdn: 'active', player: 'active', screen: 'active' }, activeConnections: ['p-c'] },
  ],
};

export const chatSim = {
  title: 'WhatsApp — Message Delivery Flow',
  description: 'Watch a message travel from sender to receiver',
  width: 600, height: 280,
  nodes: [
    { id: 'alice', x: 70, y: 140, label: 'Alice', icon: '👩' },
    { id: 'ws1', x: 220, y: 80, label: 'WS Server 1', icon: '📡' },
    { id: 'kafka', x: 370, y: 140, label: 'Kafka', icon: '📬' },
    { id: 'ws2', x: 220, y: 220, label: 'WS Server 2', icon: '📡' },
    { id: 'bob', x: 530, y: 140, label: 'Bob', icon: '👨' },
  ],
  connections: [
    { id: 'a-w1', from: 'alice', to: 'ws1' },
    { id: 'w1-k', from: 'ws1', to: 'kafka' },
    { id: 'k-w2', from: 'kafka', to: 'ws2' },
    { id: 'w2-b', from: 'ws2', to: 'bob' },
  ],
  steps: [
    { description: '👩 Alice types "Hey Bob!" and hits send', duration: 1500, nodeStates: { alice: 'active' } },
    { description: '📤 Message sent via WebSocket to Alice\'s server', duration: 1300, packet: { from: 'alice', to: 'ws1', label: '🔒 encrypted', color: '#2196f3' }, nodeStates: { alice: 'active', ws1: 'active' }, activeConnections: ['a-w1'] },
    { description: '✓ Single tick — message reached server', duration: 1000, nodeStates: { ws1: 'highlight', alice: 'active' } },
    { description: '📬 Persisted to Kafka (durable — never lost)', duration: 1300, packet: { from: 'ws1', to: 'kafka', label: 'Store msg', color: '#ff9800' }, nodeStates: { ws1: 'active', kafka: 'active' }, activeConnections: ['w1-k'] },
    { description: '🔍 Redis lookup: Bob is connected to WS Server 2', duration: 1200, nodeStates: { kafka: 'highlight' } },
    { description: '📨 Route message to Bob\'s WebSocket server', duration: 1300, packet: { from: 'kafka', to: 'ws2', label: 'Forward', color: '#9c27b0' }, nodeStates: { kafka: 'active', ws2: 'active' }, activeConnections: ['k-w2'] },
    { description: '📱 Delivered to Bob\'s phone via WebSocket', duration: 1300, packet: { from: 'ws2', to: 'bob', label: '🔓 decrypt', color: '#4caf50' }, nodeStates: { ws2: 'active', bob: 'active' }, activeConnections: ['w2-b'] },
    { description: '✓✓ Double tick — Bob received! Blue tick when Bob reads it.', duration: 1800, nodeStates: { alice: 'highlight', bob: 'highlight' } },
  ],
};


export const webCrawlerSim = {
  title: 'Web Crawler — Crawl & Index Flow',
  description: 'Watch how a crawler discovers and indexes web pages',
  width: 600, height: 280,
  nodes: [
    { id: 'frontier', x: 80, y: 140, label: 'URL Frontier', icon: '📋' },
    { id: 'fetcher', x: 250, y: 80, label: 'Fetcher', icon: '🕷️' },
    { id: 'web', x: 420, y: 80, label: 'Web Page', icon: '🌐' },
    { id: 'parser', x: 250, y: 220, label: 'Parser', icon: '🔍' },
    { id: 'store', x: 420, y: 220, label: 'Index Store', icon: '💾' },
    { id: 'dedup', x: 530, y: 140, label: 'Dedup Filter', icon: '🔄' },
  ],
  connections: [
    { id: 'f-fe', from: 'frontier', to: 'fetcher' },
    { id: 'fe-w', from: 'fetcher', to: 'web' },
    { id: 'w-p', from: 'web', to: 'parser' },
    { id: 'p-s', from: 'parser', to: 'store' },
    { id: 'p-d', from: 'parser', to: 'dedup' },
    { id: 'd-f', from: 'dedup', to: 'frontier' },
  ],
  steps: [
    { description: '📋 URL Frontier picks next URL to crawl (priority-based)', duration: 1300, nodeStates: { frontier: 'active' } },
    { description: '🕷️ Fetcher downloads the web page (respects robots.txt)', duration: 1500, packet: { from: 'frontier', to: 'fetcher', label: 'URL', color: '#2196f3' }, nodeStates: { frontier: 'active', fetcher: 'active' }, activeConnections: ['f-fe'] },
    { description: '🌐 Page downloaded — 500KB HTML content', duration: 1300, packet: { from: 'fetcher', to: 'web', label: 'GET', color: '#2196f3' }, nodeStates: { fetcher: 'active', web: 'active' }, activeConnections: ['fe-w'] },
    { description: '🔍 Parser extracts content + discovers 15 new links', duration: 1500, packet: { from: 'web', to: 'parser', label: 'HTML', color: '#ff9800' }, nodeStates: { web: 'active', parser: 'active' }, activeConnections: ['w-p'] },
    { description: '💾 Content stored in index for search', duration: 1200, packet: { from: 'parser', to: 'store', label: 'Index', color: '#4caf50' }, nodeStates: { parser: 'active', store: 'active' }, activeConnections: ['p-s'] },
    { description: '🔄 Bloom Filter checks: 10 URLs already seen, 5 are new', duration: 1500, packet: { from: 'parser', to: 'dedup', label: '15 URLs', color: '#9c27b0' }, nodeStates: { parser: 'active', dedup: 'active' }, activeConnections: ['p-d'] },
    { description: '📋 5 new URLs added to Frontier — cycle continues!', duration: 1500, packet: { from: 'dedup', to: 'frontier', label: '5 new', color: '#4caf50' }, nodeStates: { dedup: 'highlight', frontier: 'highlight' }, activeConnections: ['d-f'] },
  ],
};

export const newsfeedSim = {
  title: 'Facebook Newsfeed — Fanout on Write',
  description: 'Watch how a post reaches all friends\' feeds',
  width: 600, height: 300,
  nodes: [
    { id: 'author', x: 70, y: 150, label: 'Alice posts', icon: '👩' },
    { id: 'post', x: 220, y: 150, label: 'Post Service', icon: '📝' },
    { id: 'fanout', x: 370, y: 150, label: 'Fanout Svc', icon: '📢' },
    { id: 'f1', x: 530, y: 60, label: 'Bob\'s Feed', icon: '📰' },
    { id: 'f2', x: 530, y: 150, label: 'Carol\'s Feed', icon: '📰' },
    { id: 'f3', x: 530, y: 240, label: 'Dave\'s Feed', icon: '📰' },
  ],
  connections: [
    { id: 'a-p', from: 'author', to: 'post' },
    { id: 'p-f', from: 'post', to: 'fanout' },
    { id: 'f-f1', from: 'fanout', to: 'f1' },
    { id: 'f-f2', from: 'fanout', to: 'f2' },
    { id: 'f-f3', from: 'fanout', to: 'f3' },
  ],
  steps: [
    { description: '👩 Alice creates a new post: "Just got promoted! 🎉"', duration: 1500, nodeStates: { author: 'active' } },
    { description: '📝 Post saved to database', duration: 1300, packet: { from: 'author', to: 'post', label: 'New post', color: '#2196f3' }, nodeStates: { author: 'active', post: 'active' }, activeConnections: ['a-p'] },
    { description: '📢 Fanout Service gets Alice\'s friend list (500 friends)', duration: 1300, packet: { from: 'post', to: 'fanout', label: 'Fan out!', color: '#ff9800' }, nodeStates: { post: 'active', fanout: 'active' }, activeConnections: ['p-f'] },
    { description: '📰 Push post to Bob\'s feed cache', duration: 1000, packet: { from: 'fanout', to: 'f1', label: 'Post', color: '#4caf50' }, nodeStates: { fanout: 'active', f1: 'active' }, activeConnections: ['f-f1'] },
    { description: '📰 Push post to Carol\'s feed cache', duration: 1000, packet: { from: 'fanout', to: 'f2', label: 'Post', color: '#4caf50' }, nodeStates: { fanout: 'active', f2: 'active' }, activeConnections: ['f-f2'] },
    { description: '📰 Push post to Dave\'s feed cache', duration: 1000, packet: { from: 'fanout', to: 'f3', label: 'Post', color: '#4caf50' }, nodeStates: { fanout: 'active', f3: 'active' }, activeConnections: ['f-f3'] },
    { description: '✅ All 500 friends see Alice\'s post in their feed instantly!', duration: 1800, nodeStates: { f1: 'highlight', f2: 'highlight', f3: 'highlight', author: 'highlight' } },
  ],
};

export const urlShortenerSim = {
  title: 'URL Shortener — Shorten & Redirect',
  description: 'Watch how a URL gets shortened and redirected',
  width: 580, height: 260,
  nodes: [
    { id: 'user', x: 70, y: 130, label: 'User', icon: '👤' },
    { id: 'api', x: 240, y: 130, label: 'API Service', icon: '⚙️' },
    { id: 'db', x: 410, y: 60, label: 'Database', icon: '💾' },
    { id: 'cache', x: 410, y: 200, label: 'Redis Cache', icon: '⚡' },
    { id: 'dest', x: 540, y: 130, label: 'Destination', icon: '🌐' },
  ],
  connections: [
    { id: 'u-a', from: 'user', to: 'api' },
    { id: 'a-d', from: 'api', to: 'db' },
    { id: 'a-c', from: 'api', to: 'cache' },
    { id: 'a-de', from: 'api', to: 'dest' },
  ],
  steps: [
    { description: '📎 User submits long URL to shorten', duration: 1300, packet: { from: 'user', to: 'api', label: 'Long URL', color: '#2196f3' }, nodeStates: { user: 'active' }, activeConnections: ['u-a'] },
    { description: '🔢 Generate Base62 code from counter: abc123', duration: 1200, nodeStates: { api: 'active' } },
    { description: '💾 Store mapping: abc123 → long URL', duration: 1300, packet: { from: 'api', to: 'db', label: 'Save', color: '#ff9800' }, nodeStates: { api: 'active', db: 'active' }, activeConnections: ['a-d'] },
    { description: '✅ Return short URL: site.co/abc123', duration: 1200, packet: { from: 'api', to: 'user', label: 'site.co/abc123', color: '#4caf50' }, nodeStates: { api: 'highlight', user: 'active' }, activeConnections: ['u-a'] },
    { description: '🔗 Later: Someone clicks site.co/abc123', duration: 1500, packet: { from: 'user', to: 'api', label: 'GET /abc123', color: '#2196f3' }, nodeStates: { user: 'active' }, activeConnections: ['u-a'] },
    { description: '⚡ Check Redis cache first — HIT! Found the long URL', duration: 1200, packet: { from: 'api', to: 'cache', label: 'Lookup', color: '#4caf50' }, nodeStates: { api: 'active', cache: 'highlight' }, activeConnections: ['a-c'] },
    { description: '↩️ 302 Redirect to original long URL', duration: 1500, packet: { from: 'api', to: 'user', label: '302 Redirect', color: '#4caf50' }, nodeStates: { api: 'active', user: 'highlight', dest: 'highlight' }, activeConnections: ['u-a'] },
  ],
};

export const typeaheadSim = {
  title: 'Typeahead — Autocomplete Search',
  description: 'Watch how suggestions appear as you type',
  width: 560, height: 260,
  nodes: [
    { id: 'user', x: 70, y: 130, label: 'User types', icon: '⌨️' },
    { id: 'api', x: 240, y: 130, label: 'Typeahead Svc', icon: '🔍' },
    { id: 'trie', x: 420, y: 70, label: 'Trie (Memory)', icon: '🌳' },
    { id: 'rank', x: 420, y: 200, label: 'Ranker', icon: '📊' },
  ],
  connections: [
    { id: 'u-a', from: 'user', to: 'api' },
    { id: 'a-t', from: 'api', to: 'trie' },
    { id: 't-r', from: 'trie', to: 'rank' },
    { id: 'r-a', from: 'rank', to: 'api' },
  ],
  steps: [
    { description: '⌨️ User types "j" — debounce waits 150ms...', duration: 1200, nodeStates: { user: 'active' } },
    { description: '⌨️ User types "ja" — debounce waits...', duration: 800, nodeStates: { user: 'active' } },
    { description: '⌨️ User types "jav" — 150ms passed, send request!', duration: 1200, packet: { from: 'user', to: 'api', label: 'q=jav', color: '#2196f3' }, nodeStates: { user: 'active' }, activeConnections: ['u-a'] },
    { description: '🌳 Trie lookup: traverse j → a → v node', duration: 1200, packet: { from: 'api', to: 'trie', label: 'Prefix: jav', color: '#ff9800' }, nodeStates: { api: 'active', trie: 'active' }, activeConnections: ['a-t'] },
    { description: '🌳 Found pre-computed suggestions at "v" node', duration: 1000, nodeStates: { trie: 'highlight' } },
    { description: '📊 Rank by popularity: javascript(80K), java(50K), javafx(5K)', duration: 1200, packet: { from: 'trie', to: 'rank', label: '10 results', color: '#9c27b0' }, nodeStates: { trie: 'active', rank: 'active' }, activeConnections: ['t-r'] },
    { description: '✅ Top 5 suggestions returned in < 50ms!', duration: 1500, packet: { from: 'api', to: 'user', label: '5 suggestions', color: '#4caf50' }, nodeStates: { api: 'active', user: 'highlight' }, activeConnections: ['u-a'] },
  ],
};

export const cloudStorageSim = {
  title: 'Dropbox — File Sync with Chunking',
  description: 'Watch how a file edit syncs across devices',
  width: 600, height: 280,
  nodes: [
    { id: 'laptop', x: 70, y: 80, label: 'Laptop', icon: '💻' },
    { id: 'sync', x: 280, y: 140, label: 'Sync Service', icon: '🔄' },
    { id: 'store', x: 480, y: 80, label: 'S3 Storage', icon: '☁️' },
    { id: 'phone', x: 70, y: 220, label: 'Phone', icon: '📱' },
    { id: 'notify', x: 480, y: 220, label: 'Notification', icon: '🔔' },
  ],
  connections: [
    { id: 'l-s', from: 'laptop', to: 'sync' },
    { id: 's-st', from: 'sync', to: 'store' },
    { id: 's-n', from: 'sync', to: 'notify' },
    { id: 'n-p', from: 'notify', to: 'phone' },
    { id: 'p-s', from: 'phone', to: 'sync' },
  ],
  steps: [
    { description: '💻 User edits page 5 of a 100MB PDF on laptop', duration: 1500, nodeStates: { laptop: 'active' } },
    { description: '🔍 Client detects only chunk #5 changed (4MB of 100MB)', duration: 1300, nodeStates: { laptop: 'highlight' } },
    { description: '📤 Upload only the changed chunk (4MB, not 100MB!)', duration: 1500, packet: { from: 'laptop', to: 'sync', label: 'Chunk #5', color: '#2196f3' }, nodeStates: { laptop: 'active', sync: 'active' }, activeConnections: ['l-s'] },
    { description: '☁️ New chunk stored in S3, metadata updated', duration: 1300, packet: { from: 'sync', to: 'store', label: 'Store', color: '#ff9800' }, nodeStates: { sync: 'active', store: 'active' }, activeConnections: ['s-st'] },
    { description: '🔔 Push notification to all other devices', duration: 1300, packet: { from: 'sync', to: 'notify', label: 'File changed!', color: '#9c27b0' }, nodeStates: { sync: 'active', notify: 'active' }, activeConnections: ['s-n'] },
    { description: '📱 Phone receives notification, downloads only chunk #5', duration: 1500, packet: { from: 'notify', to: 'phone', label: 'Sync chunk #5', color: '#4caf50' }, nodeStates: { notify: 'active', phone: 'active' }, activeConnections: ['n-p'] },
    { description: '✅ Both devices in sync! Only 4MB transferred (not 100MB)', duration: 1800, nodeStates: { laptop: 'highlight', phone: 'highlight', store: 'highlight' } },
  ],
};


export const recommendationSim = {
  title: 'Recommendation Engine — How Netflix Suggests',
  description: 'Watch how recommendations are generated',
  width: 580, height: 260,
  nodes: [
    { id: 'user', x: 70, y: 130, label: 'User opens app', icon: '👤' },
    { id: 'api', x: 230, y: 130, label: 'Rec Service', icon: '🎯' },
    { id: 'cf', x: 400, y: 50, label: 'Collab Filter', icon: '👥' },
    { id: 'cb', x: 400, y: 130, label: 'Content-Based', icon: '🎬' },
    { id: 'trend', x: 400, y: 210, label: 'Trending', icon: '📈' },
  ],
  connections: [
    { id: 'u-a', from: 'user', to: 'api' },
    { id: 'a-cf', from: 'api', to: 'cf' },
    { id: 'a-cb', from: 'api', to: 'cb' },
    { id: 'a-tr', from: 'api', to: 'trend' },
  ],
  steps: [
    { description: '👤 User opens Netflix — request personalized feed', duration: 1300, packet: { from: 'user', to: 'api', label: 'Feed', color: '#2196f3' }, nodeStates: { user: 'active' }, activeConnections: ['u-a'] },
    { description: '👥 Collaborative: "Users like you watched Inception, Dark Knight"', duration: 1500, packet: { from: 'api', to: 'cf', label: 'Similar users', color: '#9c27b0' }, nodeStates: { api: 'active', cf: 'active' }, activeConnections: ['a-cf'] },
    { description: '🎬 Content-based: "You liked Sci-Fi → here\'s Interstellar"', duration: 1500, packet: { from: 'api', to: 'cb', label: 'Genre match', color: '#ff9800' }, nodeStates: { api: 'active', cb: 'active' }, activeConnections: ['a-cb'] },
    { description: '📈 Trending: "Popular in India right now"', duration: 1300, packet: { from: 'api', to: 'trend', label: 'Trending', color: '#4caf50' }, nodeStates: { api: 'active', trend: 'active' }, activeConnections: ['a-tr'] },
    { description: '🎯 ML model re-ranks 1000 candidates → Top 50 shown', duration: 1500, nodeStates: { api: 'highlight', cf: 'highlight', cb: 'highlight', trend: 'highlight' } },
    { description: '✅ Personalized homepage in < 200ms!', duration: 1500, packet: { from: 'api', to: 'user', label: '50 picks', color: '#4caf50' }, nodeStates: { user: 'highlight', api: 'active' }, activeConnections: ['u-a'] },
  ],
};

export const parkingLotSim = {
  title: 'Parking Lot — Vehicle Entry & Spot Assignment',
  description: 'Watch how a vehicle gets assigned a parking spot',
  width: 560, height: 260,
  nodes: [
    { id: 'car', x: 70, y: 130, label: 'Car arrives', icon: '🚗' },
    { id: 'gate', x: 210, y: 130, label: 'Entry Gate', icon: '🚧' },
    { id: 'ctrl', x: 360, y: 70, label: 'Controller', icon: '🧠' },
    { id: 'spot', x: 360, y: 200, label: 'Spot L2-A5', icon: '🅿️' },
    { id: 'ticket', x: 500, y: 130, label: 'Ticket', icon: '🎫' },
  ],
  connections: [
    { id: 'c-g', from: 'car', to: 'gate' },
    { id: 'g-ct', from: 'gate', to: 'ctrl' },
    { id: 'ct-s', from: 'ctrl', to: 'spot' },
    { id: 'ct-t', from: 'ctrl', to: 'ticket' },
  ],
  steps: [
    { description: '🚗 Car arrives at entry gate', duration: 1300, nodeStates: { car: 'active' } },
    { description: '🚧 Gate sensor detects vehicle type: Regular Car', duration: 1200, packet: { from: 'car', to: 'gate', label: 'Detect', color: '#2196f3' }, nodeStates: { car: 'active', gate: 'active' }, activeConnections: ['c-g'] },
    { description: '🧠 Controller searches: smallest suitable spot on nearest level', duration: 1500, packet: { from: 'gate', to: 'ctrl', label: 'Find spot', color: '#ff9800' }, nodeStates: { gate: 'active', ctrl: 'active' }, activeConnections: ['g-ct'] },
    { description: '🅿️ Found! Level 2, Row A, Spot 5 (Regular size) — CAS lock acquired', duration: 1500, packet: { from: 'ctrl', to: 'spot', label: 'Assign', color: '#4caf50' }, nodeStates: { ctrl: 'active', spot: 'highlight' }, activeConnections: ['ct-s'] },
    { description: '🎫 Ticket generated: Entry 10:30 AM, Spot L2-A5, Rate ₹40/hr', duration: 1300, packet: { from: 'ctrl', to: 'ticket', label: 'Print', color: '#4caf50' }, nodeStates: { ctrl: 'active', ticket: 'active' }, activeConnections: ['ct-t'] },
    { description: '🚧 Gate opens! Display shows "L2 → Row A → Spot 5"', duration: 1500, nodeStates: { gate: 'highlight', car: 'highlight', spot: 'highlight' } },
  ],
};

export const trafficControlSim = {
  title: 'Traffic Control — Signal State Machine',
  description: 'Watch traffic lights cycle through states safely',
  width: 560, height: 280,
  nodes: [
    { id: 'ns', x: 140, y: 70, label: 'North-South', icon: '🟢' },
    { id: 'ctrl', x: 280, y: 150, label: 'Controller', icon: '🧠' },
    { id: 'ew', x: 420, y: 70, label: 'East-West', icon: '🔴' },
    { id: 'sensor', x: 140, y: 230, label: 'Sensor', icon: '📡' },
    { id: 'emerg', x: 420, y: 230, label: 'Emergency', icon: '🚑' },
  ],
  connections: [
    { id: 'c-ns', from: 'ctrl', to: 'ns' },
    { id: 'c-ew', from: 'ctrl', to: 'ew' },
    { id: 's-c', from: 'sensor', to: 'ctrl' },
    { id: 'e-c', from: 'emerg', to: 'ctrl' },
  ],
  steps: [
    { description: '🟢 North-South: GREEN | 🔴 East-West: RED', duration: 2000, nodeStates: { ns: 'active', ew: 'error', ctrl: 'active' }, activeConnections: ['c-ns'] },
    { description: '🟡 North-South: YELLOW (5 sec warning)', duration: 1500, nodeStates: { ns: 'warn', ew: 'error', ctrl: 'active' } },
    { description: '🔴 ALL RED — 2 second safety buffer (cars clearing intersection)', duration: 1800, nodeStates: { ns: 'error', ew: 'error', ctrl: 'warn' } },
    { description: '🟢 East-West: GREEN | 🔴 North-South: RED', duration: 2000, nodeStates: { ns: 'error', ew: 'active', ctrl: 'active' }, activeConnections: ['c-ew'] },
    { description: '📡 Sensor detects heavy traffic on North-South road', duration: 1500, packet: { from: 'sensor', to: 'ctrl', label: '20 cars waiting', color: '#ff9800' }, nodeStates: { sensor: 'active', ctrl: 'active' }, activeConnections: ['s-c'] },
    { description: '🧠 Controller extends North-South green by 15 seconds next cycle', duration: 1200, nodeStates: { ctrl: 'highlight' } },
    { description: '🚑 EMERGENCY! Ambulance detected approaching from North!', duration: 1800, packet: { from: 'emerg', to: 'ctrl', label: 'OVERRIDE!', color: '#f44336' }, nodeStates: { emerg: 'error', ctrl: 'error' }, activeConnections: ['e-c'] },
    { description: '🔴 ALL RED → Then North: GREEN only. Ambulance passes safely!', duration: 2000, nodeStates: { ns: 'highlight', ew: 'error', ctrl: 'highlight', emerg: 'highlight' }, activeConnections: ['c-ns'] },
  ],
};




export const paymentGatewaySim = {
  title: 'Payment Gateway — Transaction Flow',
  description: 'Watch how a payment is processed with idempotency',
  width: 600, height: 280,
  nodes: [
    { id: 'user', x: 70, y: 140, label: 'Customer', icon: '👤' },
    { id: 'merchant', x: 220, y: 140, label: 'Merchant', icon: '🏪' },
    { id: 'gateway', x: 370, y: 140, label: 'Payment GW', icon: '💳' },
    { id: 'bank', x: 520, y: 80, label: 'Bank', icon: '🏦' },
    { id: 'ledger', x: 520, y: 210, label: 'Ledger', icon: '📒' },
  ],
  connections: [
    { id: 'u-m', from: 'user', to: 'merchant' },
    { id: 'm-g', from: 'merchant', to: 'gateway' },
    { id: 'g-b', from: 'gateway', to: 'bank' },
    { id: 'g-l', from: 'gateway', to: 'ledger' },
  ],
  steps: [
    { description: '👤 Customer clicks "Pay ₹999" on checkout page', duration: 1300, nodeStates: { user: 'active' } },
    { description: '🏪 Merchant sends payment request with idempotency key', duration: 1400, packet: { from: 'user', to: 'merchant', label: 'Pay ₹999', color: '#2196f3' }, nodeStates: { user: 'active', merchant: 'active' }, activeConnections: ['u-m'] },
    { description: '💳 Gateway creates transaction (PENDING), checks for duplicates', duration: 1400, packet: { from: 'merchant', to: 'gateway', label: 'Charge', color: '#ff9800' }, nodeStates: { merchant: 'active', gateway: 'active' }, activeConnections: ['m-g'] },
    { description: '🏦 Bank authorizes: sufficient balance, card not blocked', duration: 1500, packet: { from: 'gateway', to: 'bank', label: 'Authorize', color: '#2196f3' }, nodeStates: { gateway: 'active', bank: 'active' }, activeConnections: ['g-b'] },
    { description: '✅ Bank approves! Funds held. Transaction → AUTHORIZED', duration: 1300, nodeStates: { bank: 'highlight', gateway: 'active' } },
    { description: '📒 Record in ledger: debit customer, credit merchant', duration: 1400, packet: { from: 'gateway', to: 'ledger', label: 'Record', color: '#4caf50' }, nodeStates: { gateway: 'active', ledger: 'active' }, activeConnections: ['g-l'] },
    { description: '✅ Payment complete! Customer sees "Payment Successful"', duration: 1500, packet: { from: 'gateway', to: 'user', label: 'Success ✅', color: '#4caf50' }, nodeStates: { user: 'highlight', gateway: 'highlight', ledger: 'highlight' }, activeConnections: ['m-g', 'u-m'] },
  ],
};

export const stockTradingSim = {
  title: 'Stock Trading — Order Matching Engine',
  description: 'Watch how buy and sell orders get matched',
  width: 600, height: 280,
  nodes: [
    { id: 'buyer', x: 70, y: 100, label: 'Buyer', icon: '📈' },
    { id: 'seller', x: 70, y: 210, label: 'Seller', icon: '📉' },
    { id: 'engine', x: 300, y: 140, label: 'Match Engine', icon: '⚡' },
    { id: 'book', x: 500, y: 80, label: 'Order Book', icon: '📖' },
    { id: 'settle', x: 500, y: 210, label: 'Settlement', icon: '🤝' },
  ],
  connections: [
    { id: 'b-e', from: 'buyer', to: 'engine' },
    { id: 's-e', from: 'seller', to: 'engine' },
    { id: 'e-ob', from: 'engine', to: 'book' },
    { id: 'e-st', from: 'engine', to: 'settle' },
  ],
  steps: [
    { description: '📈 Buyer places order: BUY 100 shares of INFY at ₹1500', duration: 1400, packet: { from: 'buyer', to: 'engine', label: 'BUY 100@1500', color: '#4caf50' }, nodeStates: { buyer: 'active' }, activeConnections: ['b-e'] },
    { description: '📖 No matching sell order yet → Added to Order Book', duration: 1300, packet: { from: 'engine', to: 'book', label: 'Queue', color: '#ff9800' }, nodeStates: { engine: 'active', book: 'active' }, activeConnections: ['e-ob'] },
    { description: '📉 Seller places order: SELL 100 shares of INFY at ₹1500', duration: 1400, packet: { from: 'seller', to: 'engine', label: 'SELL 100@1500', color: '#f44336' }, nodeStates: { seller: 'active' }, activeConnections: ['s-e'] },
    { description: '⚡ MATCH FOUND! Buy ₹1500 meets Sell ₹1500 → Execute trade', duration: 1600, nodeStates: { engine: 'highlight' } },
    { description: '🤝 Settlement: Transfer shares to buyer, money to seller', duration: 1500, packet: { from: 'engine', to: 'settle', label: 'Trade executed', color: '#4caf50' }, nodeStates: { engine: 'active', settle: 'active' }, activeConnections: ['e-st'] },
    { description: '✅ Trade complete! Both parties notified in < 10ms', duration: 1500, nodeStates: { buyer: 'highlight', seller: 'highlight', settle: 'highlight' } },
  ],
};

export const fraudDetectionSim = {
  title: 'Fraud Detection — Real-Time Pipeline',
  description: 'Watch how a transaction is checked for fraud in real-time',
  width: 600, height: 280,
  nodes: [
    { id: 'txn', x: 70, y: 140, label: 'Transaction', icon: '💳' },
    { id: 'stream', x: 220, y: 140, label: 'Stream Proc', icon: '⚡' },
    { id: 'rules', x: 380, y: 70, label: 'Rule Engine', icon: '📋' },
    { id: 'ml', x: 380, y: 210, label: 'ML Model', icon: '🤖' },
    { id: 'decision', x: 530, y: 140, label: 'Decision', icon: '✅' },
  ],
  connections: [
    { id: 't-s', from: 'txn', to: 'stream' },
    { id: 's-r', from: 'stream', to: 'rules' },
    { id: 's-m', from: 'stream', to: 'ml' },
    { id: 'r-d', from: 'rules', to: 'decision' },
    { id: 'm-d', from: 'ml', to: 'decision' },
  ],
  steps: [
    { description: '💳 Transaction: ₹50,000 purchase from new device in new city', duration: 1400, nodeStates: { txn: 'active' } },
    { description: '⚡ Kafka streams the transaction for real-time analysis', duration: 1300, packet: { from: 'txn', to: 'stream', label: 'Analyze', color: '#2196f3' }, nodeStates: { txn: 'active', stream: 'active' }, activeConnections: ['t-s'] },
    { description: '📋 Rule Engine: Amount > ₹10K + new device + new city = HIGH RISK', duration: 1500, packet: { from: 'stream', to: 'rules', label: 'Check rules', color: '#ff9800' }, nodeStates: { stream: 'active', rules: 'warn' }, activeConnections: ['s-r'] },
    { description: '🤖 ML Model: Spending pattern anomaly score = 0.87 (high)', duration: 1500, packet: { from: 'stream', to: 'ml', label: 'Score', color: '#9c27b0' }, nodeStates: { stream: 'active', ml: 'warn' }, activeConnections: ['s-m'] },
    { description: '🚨 Both signals HIGH → Block transaction + send OTP verification', duration: 1600, nodeStates: { rules: 'error', ml: 'error', decision: 'error' } },
    { description: '📱 User receives OTP, verifies → Transaction approved after 2FA', duration: 1500, nodeStates: { decision: 'highlight', txn: 'highlight' } },
  ],
};

export const dataIngestionSim = {
  title: 'Data Ingestion — Multi-Tenant CSV Pipeline',
  description: 'Watch how files are processed in parallel',
  width: 600, height: 280,
  nodes: [
    { id: 'upload', x: 70, y: 140, label: 'File Upload', icon: '📤' },
    { id: 's3', x: 220, y: 80, label: 'S3 Bucket', icon: '☁️' },
    { id: 'kafka', x: 220, y: 210, label: 'Kafka', icon: '📬' },
    { id: 'worker', x: 400, y: 140, label: 'Worker Pool', icon: '⚙️' },
    { id: 'db', x: 540, y: 140, label: 'Database', icon: '💾' },
  ],
  connections: [
    { id: 'u-s3', from: 'upload', to: 's3' },
    { id: 'u-k', from: 'upload', to: 'kafka' },
    { id: 'k-w', from: 'kafka', to: 'worker' },
    { id: 'w-db', from: 'worker', to: 'db' },
  ],
  steps: [
    { description: '📤 Tenant uploads 500MB CSV file (2M rows)', duration: 1400, nodeStates: { upload: 'active' } },
    { description: '☁️ File stored in S3, metadata event published', duration: 1300, packet: { from: 'upload', to: 's3', label: '500MB CSV', color: '#2196f3' }, nodeStates: { upload: 'active', s3: 'active' }, activeConnections: ['u-s3'] },
    { description: '📬 Kafka event triggers processing pipeline', duration: 1300, packet: { from: 'upload', to: 'kafka', label: 'Process!', color: '#ff9800' }, nodeStates: { kafka: 'active' }, activeConnections: ['u-k'] },
    { description: '⚙️ Worker pool splits into 10 parallel chunks (200K rows each)', duration: 1500, packet: { from: 'kafka', to: 'worker', label: '10 chunks', color: '#9c27b0' }, nodeStates: { kafka: 'active', worker: 'active' }, activeConnections: ['k-w'] },
    { description: '💾 Each worker validates, transforms, and batch-inserts to DB', duration: 1500, packet: { from: 'worker', to: 'db', label: 'Batch insert', color: '#4caf50' }, nodeStates: { worker: 'active', db: 'active' }, activeConnections: ['w-db'] },
    { description: '✅ 2M rows processed in 45 seconds! Tenant notified.', duration: 1500, nodeStates: { upload: 'highlight', db: 'highlight', worker: 'highlight' } },
  ],
};

export const liveStreamingSim = {
  title: 'Live Streaming — Ingest to Viewer',
  description: 'Watch how a live stream reaches millions of viewers',
  width: 600, height: 280,
  nodes: [
    { id: 'camera', x: 70, y: 140, label: 'Camera', icon: '📹' },
    { id: 'ingest', x: 220, y: 140, label: 'Ingest Server', icon: '📡' },
    { id: 'transcode', x: 370, y: 80, label: 'Transcoder', icon: '🔄' },
    { id: 'cdn', x: 370, y: 210, label: 'CDN Edge', icon: '🌐' },
    { id: 'viewer', x: 530, y: 140, label: 'Viewers (1M)', icon: '👥' },
  ],
  connections: [
    { id: 'c-i', from: 'camera', to: 'ingest' },
    { id: 'i-t', from: 'ingest', to: 'transcode' },
    { id: 't-cdn', from: 'transcode', to: 'cdn' },
    { id: 'cdn-v', from: 'cdn', to: 'viewer' },
  ],
  steps: [
    { description: '📹 Camera captures live video at 4K 60fps', duration: 1300, nodeStates: { camera: 'active' } },
    { description: '📡 RTMP stream sent to ingest server', duration: 1300, packet: { from: 'camera', to: 'ingest', label: 'RTMP 4K', color: '#2196f3' }, nodeStates: { camera: 'active', ingest: 'active' }, activeConnections: ['c-i'] },
    { description: '🔄 Real-time transcode into 1080p, 720p, 480p, 360p', duration: 1500, packet: { from: 'ingest', to: 'transcode', label: 'Transcode', color: '#ff9800' }, nodeStates: { ingest: 'active', transcode: 'active' }, activeConnections: ['i-t'] },
    { description: '🌐 2-second HLS chunks pushed to CDN edges worldwide', duration: 1400, packet: { from: 'transcode', to: 'cdn', label: 'HLS chunks', color: '#9c27b0' }, nodeStates: { transcode: 'active', cdn: 'active' }, activeConnections: ['t-cdn'] },
    { description: '👥 1 million viewers pull chunks from nearest CDN edge', duration: 1500, packet: { from: 'cdn', to: 'viewer', label: 'Stream', color: '#4caf50' }, nodeStates: { cdn: 'highlight', viewer: 'active' }, activeConnections: ['cdn-v'] },
    { description: '✅ Live with ~5 second delay. Each viewer gets adaptive quality!', duration: 1500, nodeStates: { camera: 'highlight', viewer: 'highlight', cdn: 'highlight' } },
  ],
};


export const databaseDecisionsSim = {
  title: 'Database Decisions — SQL vs NoSQL Query Path',
  description: 'See how SQL and NoSQL handle the same query differently',
  width: 580, height: 260,
  nodes: [
    { id: 'app', x: 70, y: 130, label: 'Application', icon: '📱' },
    { id: 'sql', x: 300, y: 60, label: 'PostgreSQL', icon: '🐘' },
    { id: 'nosql', x: 300, y: 200, label: 'DynamoDB', icon: '⚡' },
    { id: 'result', x: 500, y: 130, label: 'Result', icon: '📊' },
  ],
  connections: [
    { id: 'a-sq', from: 'app', to: 'sql' },
    { id: 'a-ns', from: 'app', to: 'nosql' },
    { id: 'sq-r', from: 'sql', to: 'result' },
    { id: 'ns-r', from: 'nosql', to: 'result' },
  ],
  steps: [
    { description: '📱 App needs: "Get all orders for user X with total > ₹1000"', duration: 1500, nodeStates: { app: 'active' } },
    { description: '🐘 SQL: SELECT * FROM orders WHERE user_id=X AND total>1000 (JOIN + INDEX)', duration: 1500, packet: { from: 'app', to: 'sql', label: 'Complex query', color: '#2196f3' }, nodeStates: { app: 'active', sql: 'active' }, activeConnections: ['a-sq'] },
    { description: '🐘 SQL scans index, joins tables → 50ms (flexible but slower at scale)', duration: 1400, packet: { from: 'sql', to: 'result', label: '50ms', color: '#ff9800' }, nodeStates: { sql: 'active', result: 'active' }, activeConnections: ['sq-r'] },
    { description: '⚡ NoSQL: Query by partition key (user_id) → filter in app', duration: 1500, packet: { from: 'app', to: 'nosql', label: 'Key lookup', color: '#4caf50' }, nodeStates: { app: 'active', nosql: 'active' }, activeConnections: ['a-ns'] },
    { description: '⚡ NoSQL returns in 5ms! But filtering total>1000 happens in app code', duration: 1400, packet: { from: 'nosql', to: 'result', label: '5ms', color: '#4caf50' }, nodeStates: { nosql: 'highlight', result: 'highlight' }, activeConnections: ['ns-r'] },
    { description: '💡 Trade-off: SQL = flexible queries, NoSQL = fast key lookups at scale', duration: 1800, nodeStates: { sql: 'highlight', nosql: 'highlight' } },
  ],
};

export const cachingStrategySim = cdnSim; // reuse CDN sim — same cache hit/miss concept

export const messagingDecisionsSim = {
  title: 'Messaging — Kafka vs RabbitMQ',
  description: 'See how different message brokers handle messages',
  width: 600, height: 280,
  nodes: [
    { id: 'producer', x: 70, y: 140, label: 'Producer', icon: '📤' },
    { id: 'kafka', x: 300, y: 70, label: 'Kafka', icon: '📬' },
    { id: 'rabbit', x: 300, y: 210, label: 'RabbitMQ', icon: '🐰' },
    { id: 'c1', x: 520, y: 70, label: 'Consumer 1', icon: '📥' },
    { id: 'c2', x: 520, y: 210, label: 'Consumer 2', icon: '📥' },
  ],
  connections: [
    { id: 'p-k', from: 'producer', to: 'kafka' },
    { id: 'p-r', from: 'producer', to: 'rabbit' },
    { id: 'k-c1', from: 'kafka', to: 'c1' },
    { id: 'r-c2', from: 'rabbit', to: 'c2' },
  ],
  steps: [
    { description: '📤 Producer sends "Order Created" event', duration: 1300, nodeStates: { producer: 'active' } },
    { description: '📬 Kafka: Appends to partition log (retained for 7 days)', duration: 1400, packet: { from: 'producer', to: 'kafka', label: 'Append', color: '#2196f3' }, nodeStates: { producer: 'active', kafka: 'active' }, activeConnections: ['p-k'] },
    { description: '📥 Consumer 1 pulls from Kafka at its own pace (consumer controls)', duration: 1400, packet: { from: 'kafka', to: 'c1', label: 'Pull', color: '#4caf50' }, nodeStates: { kafka: 'active', c1: 'active' }, activeConnections: ['k-c1'] },
    { description: '🐰 RabbitMQ: Pushes message to queue (deleted after consumed)', duration: 1400, packet: { from: 'producer', to: 'rabbit', label: 'Push', color: '#ff9800' }, nodeStates: { producer: 'active', rabbit: 'active' }, activeConnections: ['p-r'] },
    { description: '📥 Consumer 2 receives push from RabbitMQ (broker controls)', duration: 1400, packet: { from: 'rabbit', to: 'c2', label: 'Push', color: '#ff9800' }, nodeStates: { rabbit: 'active', c2: 'active' }, activeConnections: ['r-c2'] },
    { description: '💡 Kafka: replay-able log, high throughput | RabbitMQ: smart routing, ACK-based', duration: 1800, nodeStates: { kafka: 'highlight', rabbit: 'highlight' } },
  ],
};

export const authSecuritySim = {
  title: 'OAuth2 — Authorization Code Flow',
  description: 'Watch how OAuth2 login works step by step',
  width: 600, height: 280,
  nodes: [
    { id: 'user', x: 70, y: 140, label: 'User', icon: '👤' },
    { id: 'app', x: 230, y: 140, label: 'Your App', icon: '📱' },
    { id: 'auth', x: 420, y: 80, label: 'Auth Server', icon: '🔐' },
    { id: 'api', x: 420, y: 210, label: 'Resource API', icon: '📡' },
  ],
  connections: [
    { id: 'u-a', from: 'user', to: 'app' },
    { id: 'a-au', from: 'app', to: 'auth' },
    { id: 'a-api', from: 'app', to: 'api' },
  ],
  steps: [
    { description: '👤 User clicks "Login with Google"', duration: 1300, packet: { from: 'user', to: 'app', label: 'Login', color: '#2196f3' }, nodeStates: { user: 'active' }, activeConnections: ['u-a'] },
    { description: '📱 App redirects to Google Auth (with client_id + redirect_uri)', duration: 1400, packet: { from: 'app', to: 'auth', label: 'Authorize?', color: '#ff9800' }, nodeStates: { app: 'active', auth: 'active' }, activeConnections: ['a-au'] },
    { description: '🔐 User logs in to Google, grants permission', duration: 1500, nodeStates: { auth: 'highlight', user: 'active' } },
    { description: '🔐 Auth server returns authorization code to app', duration: 1400, packet: { from: 'auth', to: 'app', label: 'Auth code', color: '#9c27b0' }, nodeStates: { auth: 'active', app: 'active' }, activeConnections: ['a-au'] },
    { description: '📱 App exchanges code for access token (server-to-server)', duration: 1400, packet: { from: 'app', to: 'auth', label: 'Code→Token', color: '#2196f3' }, nodeStates: { app: 'active', auth: 'active' }, activeConnections: ['a-au'] },
    { description: '📡 App uses token to call Google API for user profile', duration: 1400, packet: { from: 'app', to: 'api', label: 'Bearer token', color: '#4caf50' }, nodeStates: { app: 'active', api: 'active' }, activeConnections: ['a-api'] },
    { description: '✅ User logged in! Session created. Welcome, user!', duration: 1500, nodeStates: { user: 'highlight', app: 'highlight' } },
  ],
};

export const microservicesPatternsSim = {
  title: 'Microservices — Circuit Breaker Pattern',
  description: 'Watch how a circuit breaker protects against cascading failures',
  width: 600, height: 260,
  nodes: [
    { id: 'svcA', x: 80, y: 130, label: 'Order Service', icon: '📦' },
    { id: 'cb', x: 270, y: 130, label: 'Circuit Breaker', icon: '⚡' },
    { id: 'svcB', x: 460, y: 70, label: 'Payment Svc', icon: '💳' },
    { id: 'fallback', x: 460, y: 200, label: 'Fallback', icon: '🔄' },
  ],
  connections: [
    { id: 'a-cb', from: 'svcA', to: 'cb' },
    { id: 'cb-b', from: 'cb', to: 'svcB' },
    { id: 'cb-f', from: 'cb', to: 'fallback' },
  ],
  steps: [
    { description: '📦 Order Service calls Payment Service (circuit: CLOSED ✅)', duration: 1400, packet: { from: 'svcA', to: 'cb', label: 'Pay', color: '#4caf50' }, nodeStates: { svcA: 'active', cb: 'active' }, activeConnections: ['a-cb'] },
    { description: '💳 Payment Service responds OK — circuit stays CLOSED', duration: 1300, packet: { from: 'cb', to: 'svcB', label: 'OK', color: '#4caf50' }, nodeStates: { cb: 'active', svcB: 'active' }, activeConnections: ['cb-b'] },
    { description: '💳 Payment Service starts failing... 3 failures in a row', duration: 1500, packet: { from: 'cb', to: 'svcB', label: 'Timeout!', color: '#f44336' }, nodeStates: { cb: 'warn', svcB: 'error' }, activeConnections: ['cb-b'] },
    { description: '⚡ Circuit OPENS! Stops calling Payment Service to prevent cascade', duration: 1600, nodeStates: { cb: 'error', svcB: 'error' } },
    { description: '🔄 All requests go to fallback: "Payment queued, retry later"', duration: 1500, packet: { from: 'cb', to: 'fallback', label: 'Fallback', color: '#ff9800' }, nodeStates: { cb: 'error', fallback: 'active' }, activeConnections: ['cb-f'] },
    { description: '⏳ After 30s, circuit goes HALF-OPEN — tries one request', duration: 1500, packet: { from: 'cb', to: 'svcB', label: 'Test', color: '#2196f3' }, nodeStates: { cb: 'warn', svcB: 'active' }, activeConnections: ['cb-b'] },
    { description: '✅ Payment Service recovered! Circuit CLOSES. Normal flow resumes.', duration: 1500, nodeStates: { cb: 'highlight', svcB: 'highlight', svcA: 'highlight' } },
  ],
};

export const serviceCommunicationSim = {
  title: 'Service Communication — REST vs gRPC vs Kafka',
  description: 'Compare sync vs async communication patterns',
  width: 600, height: 280,
  nodes: [
    { id: 'svcA', x: 80, y: 140, label: 'Service A', icon: '📦' },
    { id: 'rest', x: 300, y: 50, label: 'REST (sync)', icon: '🔗' },
    { id: 'grpc', x: 300, y: 140, label: 'gRPC (sync)', icon: '⚡' },
    { id: 'kafka', x: 300, y: 230, label: 'Kafka (async)', icon: '📬' },
    { id: 'svcB', x: 520, y: 140, label: 'Service B', icon: '📦' },
  ],
  connections: [
    { id: 'a-rest', from: 'svcA', to: 'rest' },
    { id: 'a-grpc', from: 'svcA', to: 'grpc' },
    { id: 'a-kafka', from: 'svcA', to: 'kafka' },
    { id: 'rest-b', from: 'rest', to: 'svcB' },
    { id: 'grpc-b', from: 'grpc', to: 'svcB' },
    { id: 'kafka-b', from: 'kafka', to: 'svcB' },
  ],
  steps: [
    { description: '🔗 REST: JSON over HTTP — human readable, ~50ms latency', duration: 1500, packet: { from: 'svcA', to: 'rest', label: 'JSON', color: '#2196f3' }, nodeStates: { svcA: 'active', rest: 'active' }, activeConnections: ['a-rest'] },
    { description: '🔗 REST: Service B receives, processes, returns JSON response', duration: 1300, packet: { from: 'rest', to: 'svcB', label: '50ms', color: '#2196f3' }, nodeStates: { rest: 'active', svcB: 'active' }, activeConnections: ['rest-b'] },
    { description: '⚡ gRPC: Binary protobuf — 10x smaller, ~5ms latency', duration: 1500, packet: { from: 'svcA', to: 'grpc', label: 'Protobuf', color: '#4caf50' }, nodeStates: { svcA: 'active', grpc: 'active' }, activeConnections: ['a-grpc'] },
    { description: '⚡ gRPC: Streaming support, type-safe, blazing fast', duration: 1300, packet: { from: 'grpc', to: 'svcB', label: '5ms', color: '#4caf50' }, nodeStates: { grpc: 'highlight', svcB: 'active' }, activeConnections: ['grpc-b'] },
    { description: '📬 Kafka: Fire-and-forget — Service A doesn\'t wait for B', duration: 1500, packet: { from: 'svcA', to: 'kafka', label: 'Event', color: '#ff9800' }, nodeStates: { svcA: 'active', kafka: 'active' }, activeConnections: ['a-kafka'] },
    { description: '📬 Kafka: Service B consumes when ready — fully decoupled', duration: 1400, packet: { from: 'kafka', to: 'svcB', label: 'Async', color: '#ff9800' }, nodeStates: { kafka: 'active', svcB: 'active' }, activeConnections: ['kafka-b'] },
    { description: '💡 REST: simple APIs | gRPC: internal high-perf | Kafka: event-driven', duration: 1800, nodeStates: { rest: 'highlight', grpc: 'highlight', kafka: 'highlight' } },
  ],
};

export const distributedTransactionsSim = {
  title: 'Distributed Transactions — Saga Pattern',
  description: 'Watch how a saga coordinates across services',
  width: 600, height: 260,
  nodes: [
    { id: 'orch', x: 80, y: 130, label: 'Orchestrator', icon: '🎯' },
    { id: 'order', x: 260, y: 60, label: 'Order Svc', icon: '📦' },
    { id: 'payment', x: 420, y: 60, label: 'Payment Svc', icon: '💳' },
    { id: 'inventory', x: 260, y: 210, label: 'Inventory Svc', icon: '📦' },
    { id: 'shipping', x: 420, y: 210, label: 'Shipping Svc', icon: '🚚' },
  ],
  connections: [
    { id: 'o-or', from: 'orch', to: 'order' },
    { id: 'o-p', from: 'orch', to: 'payment' },
    { id: 'o-i', from: 'orch', to: 'inventory' },
    { id: 'o-s', from: 'orch', to: 'shipping' },
  ],
  steps: [
    { description: '🎯 Saga starts: "Place Order" — Step 1: Create Order', duration: 1400, packet: { from: 'orch', to: 'order', label: 'Create', color: '#2196f3' }, nodeStates: { orch: 'active' }, activeConnections: ['o-or'] },
    { description: '📦 Order created ✅ — Step 2: Process Payment', duration: 1300, packet: { from: 'orch', to: 'payment', label: 'Charge', color: '#ff9800' }, nodeStates: { orch: 'active', order: 'active', payment: 'active' }, activeConnections: ['o-p'] },
    { description: '💳 Payment successful ✅ — Step 3: Reserve Inventory', duration: 1300, packet: { from: 'orch', to: 'inventory', label: 'Reserve', color: '#9c27b0' }, nodeStates: { orch: 'active', payment: 'active', inventory: 'active' }, activeConnections: ['o-i'] },
    { description: '❌ Inventory FAILED! Item out of stock.', duration: 1600, nodeStates: { inventory: 'error', orch: 'error' } },
    { description: '🔄 Compensating: Refund payment...', duration: 1400, packet: { from: 'orch', to: 'payment', label: 'Refund', color: '#f44336' }, nodeStates: { orch: 'warn', payment: 'warn' }, activeConnections: ['o-p'] },
    { description: '🔄 Compensating: Cancel order...', duration: 1300, packet: { from: 'orch', to: 'order', label: 'Cancel', color: '#f44336' }, nodeStates: { orch: 'warn', order: 'warn' }, activeConnections: ['o-or'] },
    { description: '✅ Saga completed with rollback. User notified: "Item out of stock"', duration: 1500, nodeStates: { orch: 'highlight', order: 'highlight', payment: 'highlight' } },
  ],
};

export const kafkaDeepDiveSim = messagingDecisionsSim; // reuse messaging sim
export const apiGatewayPatternSim = loadBalancerSim; // similar routing concept
export const serviceDiscoverySim = loadBalancerSim; // similar discovery concept
export const cloudInfraDecisionsSim = databaseDecisionsSim; // similar decision pattern
export const aiInSystemDesignSim = recommendationSim; // similar ML pipeline


export const hashmapSim = {
  title: 'HashMap — put() Operation Internals',
  description: 'Watch what happens inside HashMap when you put a key-value pair',
  width: 580, height: 280,
  nodes: [
    { id: 'call', x: 70, y: 140, label: 'map.put()', icon: '📝' },
    { id: 'hash', x: 220, y: 80, label: 'Hash Function', icon: '#️⃣' },
    { id: 'bucket', x: 380, y: 80, label: 'Bucket[5]', icon: '🪣' },
    { id: 'node', x: 380, y: 200, label: 'Node/Tree', icon: '🌳' },
    { id: 'result', x: 530, y: 140, label: 'Stored!', icon: '✅' },
  ],
  connections: [
    { id: 'c-h', from: 'call', to: 'hash' },
    { id: 'h-b', from: 'hash', to: 'bucket' },
    { id: 'b-n', from: 'bucket', to: 'node' },
    { id: 'n-r', from: 'node', to: 'result' },
  ],
  steps: [
    { description: '📝 map.put("name", "Alice") — what happens inside?', duration: 1500, nodeStates: { call: 'active' } },
    { description: '#️⃣ Hash "name".hashCode() → 3373738 → spread → bucket index 5', duration: 1500, packet: { from: 'call', to: 'hash', label: 'hashCode()', color: '#2196f3' }, nodeStates: { call: 'active', hash: 'active' }, activeConnections: ['c-h'] },
    { description: '🪣 Go to Bucket[5] — check if key already exists', duration: 1400, packet: { from: 'hash', to: 'bucket', label: 'Index: 5', color: '#ff9800' }, nodeStates: { hash: 'active', bucket: 'active' }, activeConnections: ['h-b'] },
    { description: '🪣 Bucket empty! Create new Node(hash, "name", "Alice", null)', duration: 1400, nodeStates: { bucket: 'highlight' } },
    { description: '✅ Stored! If bucket had 8+ nodes, it converts to Red-Black Tree', duration: 1500, packet: { from: 'bucket', to: 'result', label: 'Stored', color: '#4caf50' }, nodeStates: { bucket: 'active', result: 'highlight' }, activeConnections: ['b-n', 'n-r'] },
    { description: '📊 Load factor > 0.75? → Resize array from 16 to 32, rehash all entries', duration: 1800, nodeStates: { bucket: 'warn', hash: 'warn' } },
  ],
};

export const concurrentHashmapSim = {
  title: 'ConcurrentHashMap — Thread-Safe Operations',
  description: 'Watch how ConcurrentHashMap handles concurrent access',
  width: 580, height: 280,
  nodes: [
    { id: 't1', x: 70, y: 80, label: 'Thread 1', icon: '🧵' },
    { id: 't2', x: 70, y: 200, label: 'Thread 2', icon: '🧵' },
    { id: 'map', x: 300, y: 140, label: 'CHM', icon: '🗺️' },
    { id: 'b3', x: 490, y: 80, label: 'Bucket[3]', icon: '🪣' },
    { id: 'b7', x: 490, y: 200, label: 'Bucket[7]', icon: '🪣' },
  ],
  connections: [
    { id: 't1-m', from: 't1', to: 'map' },
    { id: 't2-m', from: 't2', to: 'map' },
    { id: 'm-b3', from: 'map', to: 'b3' },
    { id: 'm-b7', from: 'map', to: 'b7' },
  ],
  steps: [
    { description: '🧵 Thread 1: put("age", 25) → hashes to Bucket[3]', duration: 1400, packet: { from: 't1', to: 'map', label: 'put()', color: '#2196f3' }, nodeStates: { t1: 'active' }, activeConnections: ['t1-m'] },
    { description: '🧵 Thread 2: put("city", "Mumbai") → hashes to Bucket[7]', duration: 1400, packet: { from: 't2', to: 'map', label: 'put()', color: '#9c27b0' }, nodeStates: { t2: 'active' }, activeConnections: ['t2-m'] },
    { description: '✅ Different buckets! Both proceed in PARALLEL — no lock contention', duration: 1500, nodeStates: { map: 'highlight' } },
    { description: '🪣 Thread 1 CAS-locks Bucket[3] only, writes "age"=25', duration: 1400, packet: { from: 'map', to: 'b3', label: 'CAS lock', color: '#4caf50' }, nodeStates: { map: 'active', b3: 'active' }, activeConnections: ['m-b3'] },
    { description: '🪣 Thread 2 CAS-locks Bucket[7] only, writes "city"="Mumbai"', duration: 1400, packet: { from: 'map', to: 'b7', label: 'CAS lock', color: '#4caf50' }, nodeStates: { map: 'active', b7: 'active' }, activeConnections: ['m-b7'] },
    { description: '✅ Both done! No global lock — only per-bucket CAS. Max concurrency!', duration: 1600, nodeStates: { t1: 'highlight', t2: 'highlight', b3: 'highlight', b7: 'highlight' } },
  ],
};

export const multithreadingSim = {
  title: 'Multithreading — Thread Pool Execution',
  description: 'Watch how an ExecutorService manages thread pool',
  width: 600, height: 280,
  nodes: [
    { id: 'submit', x: 70, y: 140, label: 'Submit Tasks', icon: '📋' },
    { id: 'queue', x: 230, y: 140, label: 'Task Queue', icon: '📬' },
    { id: 'w1', x: 430, y: 60, label: 'Worker 1', icon: '🧵' },
    { id: 'w2', x: 430, y: 140, label: 'Worker 2', icon: '🧵' },
    { id: 'w3', x: 430, y: 220, label: 'Worker 3', icon: '🧵' },
    { id: 'done', x: 560, y: 140, label: 'Complete', icon: '✅' },
  ],
  connections: [
    { id: 's-q', from: 'submit', to: 'queue' },
    { id: 'q-w1', from: 'queue', to: 'w1' },
    { id: 'q-w2', from: 'queue', to: 'w2' },
    { id: 'q-w3', from: 'queue', to: 'w3' },
  ],
  steps: [
    { description: '📋 Submit 5 tasks to ExecutorService(poolSize=3)', duration: 1400, packet: { from: 'submit', to: 'queue', label: '5 tasks', color: '#2196f3' }, nodeStates: { submit: 'active' }, activeConnections: ['s-q'] },
    { description: '🧵 Worker 1 picks Task 1 from queue', duration: 1200, packet: { from: 'queue', to: 'w1', label: 'Task 1', color: '#4caf50' }, nodeStates: { queue: 'active', w1: 'active' }, activeConnections: ['q-w1'] },
    { description: '🧵 Worker 2 picks Task 2, Worker 3 picks Task 3 — all parallel!', duration: 1300, nodeStates: { queue: 'active', w1: 'active', w2: 'active', w3: 'active' }, activeConnections: ['q-w2', 'q-w3'] },
    { description: '📬 Tasks 4 & 5 wait in queue — all 3 workers busy', duration: 1500, nodeStates: { queue: 'warn', w1: 'active', w2: 'active', w3: 'active' } },
    { description: '✅ Worker 1 finishes Task 1 → immediately picks Task 4', duration: 1300, packet: { from: 'queue', to: 'w1', label: 'Task 4', color: '#ff9800' }, nodeStates: { w1: 'active', queue: 'active' }, activeConnections: ['q-w1'] },
    { description: '✅ Worker 2 finishes → picks Task 5. All tasks assigned!', duration: 1300, nodeStates: { w1: 'active', w2: 'active', w3: 'active', queue: 'highlight' } },
    { description: '✅ All 5 tasks complete! Pool threads return to idle, ready for more', duration: 1500, nodeStates: { w1: 'highlight', w2: 'highlight', w3: 'highlight', done: 'highlight' } },
  ],
};

export const completableFutureSim = {
  title: 'CompletableFuture — Async Pipeline',
  description: 'Watch how async tasks chain and combine',
  width: 600, height: 260,
  nodes: [
    { id: 'start', x: 70, y: 130, label: 'Start', icon: '▶️' },
    { id: 'fetch', x: 220, y: 70, label: 'fetchUser()', icon: '👤' },
    { id: 'orders', x: 220, y: 200, label: 'fetchOrders()', icon: '📦' },
    { id: 'combine', x: 400, y: 130, label: 'thenCombine()', icon: '🔗' },
    { id: 'result', x: 540, y: 130, label: 'Response', icon: '✅' },
  ],
  connections: [
    { id: 's-f', from: 'start', to: 'fetch' },
    { id: 's-o', from: 'start', to: 'orders' },
    { id: 'f-c', from: 'fetch', to: 'combine' },
    { id: 'o-c', from: 'orders', to: 'combine' },
    { id: 'c-r', from: 'combine', to: 'result' },
  ],
  steps: [
    { description: '▶️ Need user profile + orders — fetch BOTH in parallel!', duration: 1400, nodeStates: { start: 'active' } },
    { description: '👤 supplyAsync(() → fetchUser()) — runs on ForkJoinPool thread', duration: 1300, packet: { from: 'start', to: 'fetch', label: 'Async', color: '#2196f3' }, nodeStates: { start: 'active', fetch: 'active' }, activeConnections: ['s-f'] },
    { description: '📦 supplyAsync(() → fetchOrders()) — runs on ANOTHER thread simultaneously', duration: 1300, packet: { from: 'start', to: 'orders', label: 'Async', color: '#9c27b0' }, nodeStates: { start: 'active', orders: 'active' }, activeConnections: ['s-o'] },
    { description: '👤 fetchUser() completes in 200ms', duration: 1200, nodeStates: { fetch: 'highlight' } },
    { description: '📦 fetchOrders() completes in 350ms', duration: 1200, nodeStates: { orders: 'highlight' } },
    { description: '🔗 thenCombine() — both done! Merge user + orders into response', duration: 1400, packet: { from: 'fetch', to: 'combine', label: 'User', color: '#4caf50' }, nodeStates: { combine: 'active' }, activeConnections: ['f-c', 'o-c'] },
    { description: '✅ Total: 350ms (not 550ms!) — parallel execution saved 200ms', duration: 1500, packet: { from: 'combine', to: 'result', label: 'Merged', color: '#4caf50' }, nodeStates: { result: 'highlight', combine: 'highlight' }, activeConnections: ['c-r'] },
  ],
};

export const javaMemoryModelSim = {
  title: 'Java Memory Model — Object Lifecycle',
  description: 'Watch where objects live and die in JVM memory',
  width: 600, height: 280,
  nodes: [
    { id: 'code', x: 70, y: 140, label: 'new Object()', icon: '📝' },
    { id: 'stack', x: 230, y: 70, label: 'Stack', icon: '📚' },
    { id: 'heap', x: 230, y: 210, label: 'Heap (Young)', icon: '🏠' },
    { id: 'old', x: 420, y: 210, label: 'Heap (Old)', icon: '🏛️' },
    { id: 'gc', x: 420, y: 70, label: 'GC', icon: '🗑️' },
  ],
  connections: [
    { id: 'c-s', from: 'code', to: 'stack' },
    { id: 'c-h', from: 'code', to: 'heap' },
    { id: 'h-o', from: 'heap', to: 'old' },
    { id: 'gc-h', from: 'gc', to: 'heap' },
  ],
  steps: [
    { description: '📝 User user = new User("Alice") — what happens in memory?', duration: 1500, nodeStates: { code: 'active' } },
    { description: '📚 Reference "user" stored on Stack (thread-local, fast)', duration: 1400, packet: { from: 'code', to: 'stack', label: 'Reference', color: '#2196f3' }, nodeStates: { code: 'active', stack: 'active' }, activeConnections: ['c-s'] },
    { description: '🏠 Object data stored on Heap (Young Gen / Eden space)', duration: 1400, packet: { from: 'code', to: 'heap', label: 'Object data', color: '#ff9800' }, nodeStates: { code: 'active', heap: 'active' }, activeConnections: ['c-h'] },
    { description: '🗑️ Minor GC runs — object still referenced → survives!', duration: 1500, packet: { from: 'gc', to: 'heap', label: 'Minor GC', color: '#9c27b0' }, nodeStates: { gc: 'active', heap: 'warn' }, activeConnections: ['gc-h'] },
    { description: '🏛️ After surviving 15 GC cycles → promoted to Old Generation', duration: 1500, packet: { from: 'heap', to: 'old', label: 'Promote', color: '#4caf50' }, nodeStates: { heap: 'active', old: 'active' }, activeConnections: ['h-o'] },
    { description: '📚 Method returns → Stack reference removed → object unreachable', duration: 1400, nodeStates: { stack: 'error', old: 'warn' } },
    { description: '🗑️ Major GC collects unreachable object → memory freed!', duration: 1500, nodeStates: { gc: 'highlight', old: 'highlight' } },
  ],
};

export const java8Sim = completableFutureSim; // streams/lambdas are similar async concept
export const java17Sim = hashmapSim; // records/sealed classes are similar data structure concept
export const codingStandardsSim = microservicesPatternsSim; // reuse patterns concept
export const reactiveSim = completableFutureSim; // reactive is similar async pipeline

// ─── Auth0 Deep Dive ──────────────────────────────────────────────────────────

export const auth0DeepDiveSim = {
  title: 'Auth0 — Authorization Code + PKCE Flow',
  description: 'Watch every step: user login → JWT issued → API validates token → data served',
  width: 620, height: 290,
  nodes: [
    { id: 'user',  x: 75,  y: 145, label: 'User / Browser', icon: '👤' },
    { id: 'spa',   x: 230, y: 80,  label: 'React SPA',      icon: '⚛️' },
    { id: 'auth0', x: 440, y: 80,  label: 'Auth0 Tenant',   icon: '🔐' },
    { id: 'api',   x: 440, y: 220, label: 'Spring API',     icon: '🖥️' },
    { id: 'jwks',  x: 570, y: 145, label: 'JWKS Endpoint',  icon: '🔑' },
  ],
  connections: [
    { id: 'u-spa',    from: 'user',  to: 'spa'   },
    { id: 'spa-auth', from: 'spa',   to: 'auth0' },
    { id: 'spa-api',  from: 'spa',   to: 'api'   },
    { id: 'api-jwks', from: 'api',   to: 'jwks'  },
  ],
  steps: [
    {
      description: '👤 User clicks "Login" — React SPA begins the PKCE flow',
      duration: 1600,
      nodeStates: { user: 'active', spa: 'active' },
      activeConnections: ['u-spa'],
      packet: { from: 'user', to: 'spa', label: 'Login', color: '#2196f3' },
    },
    {
      description: '🔑 SPA generates code_verifier (random 64-byte string) + code_challenge = SHA256(verifier). These are never stored on server.',
      duration: 2000,
      nodeStates: { spa: 'highlight' },
    },
    {
      description: '↗️ SPA redirects browser to Auth0 /authorize with code_challenge, client_id, scope=openid, audience=API identifier',
      duration: 1800,
      nodeStates: { spa: 'active', auth0: 'active' },
      activeConnections: ['spa-auth'],
      packet: { from: 'spa', to: 'auth0', label: '/authorize', color: '#ff9800' },
    },
    {
      description: '🔐 Auth0 shows Universal Login page. User enters credentials (or uses social login, SSO, MFA).',
      duration: 2200,
      nodeStates: { auth0: 'active', user: 'active' },
    },
    {
      description: '✅ Credentials verified! Auth0 generates a one-time authorization_code and redirects back to SPA callback URL.',
      duration: 1800,
      nodeStates: { auth0: 'highlight', spa: 'active' },
      activeConnections: ['spa-auth'],
      packet: { from: 'auth0', to: 'spa', label: 'auth_code', color: '#9c27b0' },
    },
    {
      description: '🔄 SPA posts code + code_verifier to Auth0 /oauth/token. Auth0 checks: SHA256(code_verifier) == code_challenge stored earlier.',
      duration: 2000,
      nodeStates: { spa: 'active', auth0: 'active' },
      activeConnections: ['spa-auth'],
      packet: { from: 'spa', to: 'auth0', label: 'code + verifier', color: '#2196f3' },
    },
    {
      description: '🎫 PKCE proof valid! Auth0 issues: access_token (JWT, 15min), id_token (user identity), refresh_token (7 days). Roles injected via Post-Login Action.',
      duration: 2200,
      nodeStates: { auth0: 'highlight' },
      activeConnections: ['spa-auth'],
      packet: { from: 'auth0', to: 'spa', label: 'JWT tokens', color: '#4caf50' },
    },
    {
      description: '💾 SPA stores access_token in MEMORY only (not localStorage). Refresh token in HTTP-only cookie. ID token decoded to show user name.',
      duration: 2000,
      nodeStates: { spa: 'highlight' },
    },
    {
      description: '📡 SPA calls Spring Boot API with Authorization: Bearer {access_token} header.',
      duration: 1800,
      nodeStates: { spa: 'active', api: 'active' },
      activeConnections: ['spa-api'],
      packet: { from: 'spa', to: 'api', label: 'Bearer JWT', color: '#4caf50' },
    },
    {
      description: '🔑 Spring Security fetches Auth0 JWKS (cached). Verifies JWT signature with RS256 public key — NO database call needed!',
      duration: 2000,
      nodeStates: { api: 'active', jwks: 'active' },
      activeConnections: ['api-jwks'],
      packet: { from: 'api', to: 'jwks', label: 'Get public key', color: '#ff9800' },
    },
    {
      description: '🛡️ JWT valid! Spring checks claims: iss ✅ aud ✅ exp ✅. JwtAuthenticationConverter maps permissions → GrantedAuthority for @PreAuthorize.',
      duration: 2000,
      nodeStates: { api: 'highlight', jwks: 'highlight' },
    },
    {
      description: '✅ Authorization passed! API returns data. Full flow: login → JWT → API call → validation — stateless, scalable, zero DB hits per request.',
      duration: 2000,
      nodeStates: { user: 'highlight', spa: 'highlight', api: 'highlight' },
      activeConnections: ['spa-api', 'u-spa'],
      packet: { from: 'api', to: 'spa', label: '200 OK + data', color: '#4caf50' },
    },
  ],
};

// ─── MCP Deep Dive ───────────────────────────────────────────────────────────

export const mcpDeepDiveSim = {
  title: 'MCP — Agentic Tool Call Loop (Host → Client → Server → Data)',
  description: 'Watch how an AI assistant uses MCP to answer a natural language question by discovering tools, calling them, and reasoning over results',
  width: 620, height: 290,
  nodes: [
    { id: 'user',   x: 70,  y: 145, label: 'User',        icon: '👤' },
    { id: 'llm',    x: 215, y: 80,  label: 'Claude (LLM)', icon: '🤖' },
    { id: 'client', x: 215, y: 215, label: 'MCP Client',   icon: '🔌' },
    { id: 'server', x: 420, y: 145, label: 'MCP Server',   icon: '🖥️' },
    { id: 'data',   x: 565, y: 145, label: 'Data Source',  icon: '💾' },
  ],
  connections: [
    { id: 'u-llm',    from: 'user',   to: 'llm'    },
    { id: 'llm-cli',  from: 'llm',    to: 'client' },
    { id: 'cli-srv',  from: 'client', to: 'server' },
    { id: 'srv-data', from: 'server', to: 'data'   },
  ],
  steps: [
    {
      description: '👤 User asks: "How many users signed up last week and what is the most common email domain?" — natural language, no SQL needed.',
      duration: 2000,
      nodeStates: { user: 'active' },
      activeConnections: ['u-llm'],
      packet: { from: 'user', to: 'llm', label: 'Question', color: '#2196f3' },
    },
    {
      description: '🤖 LLM receives the question. Before answering it queries the MCP Client: "What tools do you have?" — capability discovery via tools/list.',
      duration: 2000,
      nodeStates: { llm: 'active', client: 'active' },
      activeConnections: ['llm-cli'],
      packet: { from: 'llm', to: 'client', label: 'tools/list', color: '#ff9800' },
    },
    {
      description: '🔌 MCP Client sends tools/list to the Server over JSON-RPC 2.0. Server returns: execute_read_query, get_table_schema, count_records — with full descriptions.',
      duration: 2000,
      nodeStates: { client: 'active', server: 'highlight' },
      activeConnections: ['cli-srv'],
      packet: { from: 'client', to: 'server', label: 'tools/list', color: '#ff9800' },
    },
    {
      description: '🤖 LLM reads all tool descriptions and decides: "I need execute_read_query to answer this. I will write a SQL query." — reasoning before acting.',
      duration: 2200,
      nodeStates: { llm: 'highlight' },
    },
    {
      description: '⚙️ LLM emits a tool_use block: call execute_read_query with sql="SELECT DATE_TRUNC(\'week\',created_at), COUNT(*) FROM users WHERE..." — structured tool call.',
      duration: 2000,
      nodeStates: { llm: 'active', client: 'active' },
      activeConnections: ['llm-cli'],
      packet: { from: 'llm', to: 'client', label: 'tools/call', color: '#9c27b0' },
    },
    {
      description: '🔌 MCP Client forwards tools/call to Server via JSON-RPC. Server validates: is this a SELECT? Is input safe? No blocked keywords? — security checks pass.',
      duration: 2000,
      nodeStates: { client: 'active', server: 'active' },
      activeConnections: ['cli-srv'],
      packet: { from: 'client', to: 'server', label: 'execute_query', color: '#9c27b0' },
    },
    {
      description: '💾 MCP Server executes the validated SQL against the real database using a parameterized query. Result: 247 sign-ups, top domain gmail.com (89 users).',
      duration: 2200,
      nodeStates: { server: 'active', data: 'highlight' },
      activeConnections: ['srv-data'],
      packet: { from: 'server', to: 'data', label: 'SQL query', color: '#4caf50' },
    },
    {
      description: '↩️ Tool result travels back: Data → Server → Client → LLM as a tool_result message in the conversation. LLM now has real data to reason over.',
      duration: 2000,
      nodeStates: { data: 'active', server: 'active', client: 'active', llm: 'active' },
      activeConnections: ['srv-data', 'cli-srv', 'llm-cli'],
      packet: { from: 'data', to: 'llm', label: 'Result JSON', color: '#4caf50' },
    },
    {
      description: '🤖 LLM sees real results and may call more tools — "I should also check last month for comparison." Calls execute_read_query again with different WHERE clause.',
      duration: 2200,
      nodeStates: { llm: 'highlight' },
    },
    {
      description: '✅ stop_reason = "end_turn" — LLM has enough data. Generates human response: "Last week 247 users signed up (+12% vs prior week). Gmail dominates at 36%." User gets a precise, data-backed answer.',
      duration: 2400,
      nodeStates: { user: 'highlight', llm: 'highlight' },
      activeConnections: ['u-llm'],
      packet: { from: 'llm', to: 'user', label: 'Answer ✅', color: '#4caf50' },
    },
  ],
};

// ─── Docker Fundamentals ──────────────────────────────────────────────────────

export const dockerFundamentalsSim = {
  title: 'Docker — Image Layers, Build Cache & Container Start',
  description: 'Watch how Docker builds images in layers, exploits the build cache, and starts a container sharing the host kernel',
  width: 610, height: 280,
  nodes: [
    { id: 'dockerfile', x: 75,  y: 140, label: 'Dockerfile',    icon: '📄' },
    { id: 'cache',      x: 235, y: 65,  label: 'Build Cache',   icon: '⚡' },
    { id: 'layer1',     x: 390, y: 55,  label: 'Layer 1 (base)',icon: '📦' },
    { id: 'layer2',     x: 390, y: 145, label: 'Layer 2 (deps)',icon: '📦' },
    { id: 'layer3',     x: 390, y: 235, label: 'Layer 3 (app)', icon: '📦' },
    { id: 'container',  x: 545, y: 140, label: 'Container',     icon: '🐳' },
  ],
  connections: [
    { id: 'df-cache', from: 'dockerfile', to: 'cache'   },
    { id: 'cache-l1', from: 'cache',      to: 'layer1'  },
    { id: 'cache-l2', from: 'cache',      to: 'layer2'  },
    { id: 'df-l3',    from: 'dockerfile', to: 'layer3'  },
    { id: 'l1-con',   from: 'layer1',     to: 'container' },
    { id: 'l2-con',   from: 'layer2',     to: 'container' },
    { id: 'l3-con',   from: 'layer3',     to: 'container' },
  ],
  steps: [
    {
      description: '📄 docker build . — Docker reads Dockerfile top to bottom. Each instruction = one layer attempt.',
      duration: 1600,
      nodeStates: { dockerfile: 'active' },
    },
    {
      description: '📦 FROM eclipse-temurin:17-jre — check local cache by image digest. Layer already pulled! CACHE HIT ⚡',
      duration: 1800,
      nodeStates: { dockerfile: 'active', cache: 'highlight', layer1: 'active' },
      activeConnections: ['df-cache', 'cache-l1'],
      packet: { from: 'dockerfile', to: 'cache', label: 'FROM check', color: '#2196f3' },
    },
    {
      description: '⚡ Base layer (200MB) loaded from cache in milliseconds. No download, no rebuild. Layer ID = SHA256 hash of its contents.',
      duration: 1800,
      nodeStates: { cache: 'highlight', layer1: 'highlight' },
    },
    {
      description: '📦 RUN apt-get install curl — hash instruction + parent layer. Unchanged → CACHE HIT! Deps layer reused instantly.',
      duration: 1800,
      nodeStates: { cache: 'highlight', layer2: 'active' },
      activeConnections: ['df-cache', 'cache-l2'],
      packet: { from: 'cache', to: 'layer2', label: 'Cache HIT', color: '#4caf50' },
    },
    {
      description: '🔄 COPY app.jar — Docker checksums the file. app.jar CHANGED (new build)! Cache MISS → must rebuild this layer.',
      duration: 2000,
      nodeStates: { dockerfile: 'warn', layer3: 'warn' },
      activeConnections: ['df-l3'],
      packet: { from: 'dockerfile', to: 'layer3', label: 'Cache MISS!', color: '#f44336' },
    },
    {
      description: '📦 New app layer created (10MB). Only this one layer is rebuilt and pushed to registry — base + deps layers unchanged.',
      duration: 1800,
      nodeStates: { layer3: 'active' },
    },
    {
      description: '🏗️ Image assembled: 3 immutable read-only layers stacked via OverlayFS. Total: 210MB. Layers are content-addressed by SHA256.',
      duration: 2000,
      nodeStates: { layer1: 'highlight', layer2: 'highlight', layer3: 'highlight' },
    },
    {
      description: '🐳 docker run — Docker adds a thin WRITABLE layer on top of the read-only image layers. Container starts in milliseconds.',
      duration: 1800,
      nodeStates: { layer1: 'active', layer2: 'active', layer3: 'active', container: 'active' },
      activeConnections: ['l1-con', 'l2-con', 'l3-con'],
      packet: { from: 'layer3', to: 'container', label: 'run!', color: '#4caf50' },
    },
    {
      description: '🐧 Container shares host OS kernel via Linux namespaces (PID, net, mnt, uts) + cgroups (CPU/RAM limits). Near-native performance!',
      duration: 2000,
      nodeStates: { container: 'highlight' },
    },
    {
      description: '🗑️ docker stop → container writable layer destroyed. Image layers intact — run again instantly, same state. Named volumes survive.',
      duration: 2000,
      nodeStates: { container: 'warn', layer1: 'highlight', layer2: 'highlight', layer3: 'highlight' },
    },
  ],
};

// ─── Docker Spring Boot ───────────────────────────────────────────────────────

export const dockerSpringBootSim = {
  title: 'Dockerizing Spring Boot — Multi-Stage Layered Build',
  description: 'Watch how multi-stage builds + layered JARs produce a small, fast, cache-efficient image',
  width: 610, height: 270,
  nodes: [
    { id: 'builder',  x: 80,  y: 80,  label: 'Stage 1: JDK',  icon: '🏗️' },
    { id: 'pomxml',   x: 80,  y: 200, label: 'pom.xml',       icon: '📄' },
    { id: 'mvcache',  x: 255, y: 80,  label: 'Maven Cache',   icon: '📦' },
    { id: 'fatjar',   x: 255, y: 200, label: 'Layered JAR',   icon: '🫙' },
    { id: 'runtime',  x: 440, y: 80,  label: 'Stage 2: JRE',  icon: '🚀' },
    { id: 'health',   x: 440, y: 200, label: 'Actuator /health', icon: '💓' },
  ],
  connections: [
    { id: 'b-mv',   from: 'builder',  to: 'mvcache'  },
    { id: 'pom-mv', from: 'pomxml',   to: 'mvcache'  },
    { id: 'b-jar',  from: 'builder',  to: 'fatjar'   },
    { id: 'jar-rt', from: 'fatjar',   to: 'runtime'  },
    { id: 'rt-hl',  from: 'runtime',  to: 'health'   },
  ],
  steps: [
    {
      description: '🏗️ Stage 1 — FROM eclipse-temurin:17-jdk (600MB). Full JDK + Maven. This stage NEVER ships to production.',
      duration: 1800,
      nodeStates: { builder: 'active' },
    },
    {
      description: '📄 COPY pom.xml only (not src/ yet). This is the cache optimization key: deps are copied BEFORE source code.',
      duration: 1800,
      nodeStates: { pomxml: 'active', mvcache: 'active' },
      activeConnections: ['pom-mv'],
      packet: { from: 'pomxml', to: 'mvcache', label: 'pom.xml', color: '#2196f3' },
    },
    {
      description: '⚡ RUN mvn dependency:go-offline — downloads 40MB of dependencies. pom.xml unchanged → CACHE HIT next build! (saves 2 min per CI run)',
      duration: 2200,
      nodeStates: { mvcache: 'highlight' },
      activeConnections: ['b-mv'],
      packet: { from: 'builder', to: 'mvcache', label: '40MB deps', color: '#ff9800' },
    },
    {
      description: '📦 COPY src/ → RUN mvn package. Builds fat JAR (45MB = 40MB deps + 1MB your code + 4MB spring-loader).',
      duration: 2000,
      nodeStates: { builder: 'active', fatjar: 'active' },
      activeConnections: ['b-jar'],
      packet: { from: 'builder', to: 'fatjar', label: 'fat JAR 45MB', color: '#ff9800' },
    },
    {
      description: '✂️ java -Djarmode=layertools extract → splits JAR into 4 layers: dependencies (40MB), spring-boot-loader (1MB), snapshot-deps, application (1MB).',
      duration: 2200,
      nodeStates: { fatjar: 'highlight' },
    },
    {
      description: '🚀 Stage 2 — FROM eclipse-temurin:17-jre (200MB). JRE only — no javac, no Maven, no source code. 3× smaller than JDK stage!',
      duration: 1800,
      nodeStates: { runtime: 'active' },
      activeConnections: ['jar-rt'],
      packet: { from: 'fatjar', to: 'runtime', label: 'COPY layers', color: '#4caf50' },
    },
    {
      description: '📋 COPY 4 layers separately from builder stage. Only the 1MB "application" layer changes per commit. 40MB deps layer = permanent cache hit.',
      duration: 2200,
      nodeStates: { runtime: 'highlight' },
    },
    {
      description: '🔒 USER appuser — non-root user. ENTRYPOINT exec form → Java is PID 1, receives SIGTERM for graceful shutdown.',
      duration: 1800,
      nodeStates: { runtime: 'active' },
    },
    {
      description: '💓 Container starts — Spring Boot initializes. HEALTHCHECK polls /actuator/health/readiness every 30s. start_period=90s gives boot time.',
      duration: 2000,
      nodeStates: { runtime: 'active', health: 'active' },
      activeConnections: ['rt-hl'],
      packet: { from: 'runtime', to: 'health', label: '/health', color: '#4caf50' },
    },
    {
      description: '✅ Actuator returns 200 UP — container is HEALTHY! Final image: 220MB vs 640MB (single-stage). Only app layer pushed on each commit.',
      duration: 2000,
      nodeStates: { runtime: 'highlight', health: 'highlight' },
    },
  ],
};

// ─── Docker Compose ───────────────────────────────────────────────────────────

export const dockerComposeSim = {
  title: 'Docker Compose — Full Stack Startup with Health Checks',
  description: 'Watch Spring Boot + PostgreSQL + Redis start in the correct order using depends_on and service health checks',
  width: 610, height: 285,
  nodes: [
    { id: 'compose',  x: 70,  y: 142, label: 'docker compose up', icon: '🎼' },
    { id: 'network',  x: 225, y: 55,  label: 'myapp-network',     icon: '🌐' },
    { id: 'postgres', x: 390, y: 55,  label: 'PostgreSQL',        icon: '🐘' },
    { id: 'redis',    x: 390, y: 142, label: 'Redis',             icon: '⚡' },
    { id: 'app',      x: 390, y: 235, label: 'Spring Boot App',   icon: '🍃' },
    { id: 'health',   x: 545, y: 142, label: 'Actuator Health',   icon: '💓' },
  ],
  connections: [
    { id: 'c-net',  from: 'compose',  to: 'network'  },
    { id: 'c-pg',   from: 'compose',  to: 'postgres' },
    { id: 'c-redis',from: 'compose',  to: 'redis'    },
    { id: 'c-app',  from: 'compose',  to: 'app'      },
    { id: 'pg-app', from: 'postgres', to: 'app'      },
    { id: 'rd-app', from: 'redis',    to: 'app'      },
    { id: 'app-hl', from: 'app',      to: 'health'   },
  ],
  steps: [
    {
      description: '🎼 docker compose up -d — Compose reads docker-compose.yml. Creates project network and all declared named volumes first.',
      duration: 1800,
      nodeStates: { compose: 'active' },
    },
    {
      description: '🌐 Bridge network "myapp-network" created. Docker\'s embedded DNS will resolve service names (postgres, redis) to container IPs automatically.',
      duration: 1800,
      nodeStates: { compose: 'active', network: 'highlight' },
      activeConnections: ['c-net'],
      packet: { from: 'compose', to: 'network', label: 'Create net', color: '#2196f3' },
    },
    {
      description: '🐘 postgres:15 container starts. No depends_on — starts immediately. But PostgreSQL needs ~10s to initialise the data directory.',
      duration: 2000,
      nodeStates: { compose: 'active', postgres: 'active' },
      activeConnections: ['c-pg'],
      packet: { from: 'compose', to: 'postgres', label: 'Start', color: '#ff9800' },
    },
    {
      description: '🔍 Healthcheck polls: pg_isready -U appuser -d myapp ... FAIL (data dir init in progress). Compose waits — interval: 10s, retries: 5.',
      duration: 2000,
      nodeStates: { postgres: 'warn' },
    },
    {
      description: '✅ pg_isready returns 0 — PostgreSQL is accepting connections! postgres service marked service_healthy.',
      duration: 1800,
      nodeStates: { postgres: 'highlight' },
    },
    {
      description: '⚡ redis:7 container starts. Healthcheck: redis-cli ping → PONG in <100ms. Redis healthy almost immediately.',
      duration: 1800,
      nodeStates: { compose: 'active', redis: 'highlight' },
      activeConnections: ['c-redis'],
      packet: { from: 'compose', to: 'redis', label: 'Start', color: '#4caf50' },
    },
    {
      description: '🍃 depends_on conditions met (postgres: service_healthy, redis: service_healthy). Compose now starts the Spring Boot app.',
      duration: 2000,
      nodeStates: { postgres: 'highlight', redis: 'highlight', compose: 'active', app: 'active' },
      activeConnections: ['c-app'],
      packet: { from: 'compose', to: 'app', label: 'Start app', color: '#4caf50' },
    },
    {
      description: '🐘 App connects to postgres:5432 — Docker DNS resolves "postgres" to the container IP on myapp-network. Hikari pool initialises.',
      duration: 2000,
      nodeStates: { postgres: 'active', app: 'active' },
      activeConnections: ['pg-app'],
      packet: { from: 'postgres', to: 'app', label: 'DB connected', color: '#4caf50' },
    },
    {
      description: '⚡ App connects to redis:6379 — same network DNS magic. Spring Data Redis pool ready.',
      duration: 1800,
      nodeStates: { redis: 'active', app: 'active' },
      activeConnections: ['rd-app'],
      packet: { from: 'redis', to: 'app', label: 'Cache ready', color: '#4caf50' },
    },
    {
      description: '💓 Spring Boot finishes startup. Actuator /health/readiness → UP. App healthcheck passes after start_period=120s.',
      duration: 2000,
      nodeStates: { app: 'active', health: 'active' },
      activeConnections: ['app-hl'],
      packet: { from: 'app', to: 'health', label: '/readiness', color: '#4caf50' },
    },
    {
      description: '✅ docker compose ps — ALL services: healthy. Port 8080 open on host. docker compose down: stops all containers, removes network (volumes kept).',
      duration: 2200,
      nodeStates: { postgres: 'highlight', redis: 'highlight', app: 'highlight', health: 'highlight', network: 'highlight' },
    },
  ],
};

// Master lookup: tutorial ID → simulation config
export const simulationMap = {
  // System Design
  'thinking-system-design': loadBalancerSim,
  'rate-limiter': rateLimiterSim,
  'design-rate-limiter-distributed': rateLimiterSim,
  'cdn-deep-dive': cdnSim,
  'load-balancing': loadBalancerSim,
  'design-ride-sharing': rideSharingSim,
  'design-atm': atmSim,
  'design-netflix': netflixSim,
  'design-chat-system': chatSim,
  'design-web-crawler': webCrawlerSim,
  'design-newsfeed': newsfeedSim,
  'design-url-shortener': urlShortenerSim,
  'url-shortener': urlShortenerSim,
  'design-typeahead': typeaheadSim,
  'design-cloud-storage': cloudStorageSim,
  'design-recommendation': recommendationSim,
  'design-parking-lot': parkingLotSim,
  'design-traffic-control': trafficControlSim,
  'design-forum': newsfeedSim,
  'design-tic-tac-toe': parkingLotSim,
  'payment-gateway': paymentGatewaySim,
  'stock-trading-platform': stockTradingSim,
  'fraud-detection-system': fraudDetectionSim,
  'notification-system': newsfeedSim,
  'cache-system': cdnSim,
  // Real-World Builds
  'data-ingestion-platform': dataIngestionSim,
  'live-streaming-platform': liveStreamingSim,
  // Architecture Decisions
  'thinking-architecture': databaseDecisionsSim,
  'database-decisions': databaseDecisionsSim,
  'caching-strategy': cachingStrategySim,
  'messaging-decisions': messagingDecisionsSim,
  'auth-security-decisions': authSecuritySim,
  'cloud-infra-decisions': cloudInfraDecisionsSim,
  'ai-in-system-design': aiInSystemDesignSim,
  // Microservices
  'thinking-microservices': microservicesPatternsSim,
  'microservices-patterns': microservicesPatternsSim,
  'service-communication': serviceCommunicationSim,
  'api-gateway-pattern': apiGatewayPatternSim,
  'distributed-transactions': distributedTransactionsSim,
  'kafka-deep-dive': kafkaDeepDiveSim,
  'service-discovery': serviceDiscoverySim,
  // Java
  'thinking-java': hashmapSim,
  'hashmap-internals': hashmapSim,
  'concurrent-hashmap': concurrentHashmapSim,
  'multithreading': multithreadingSim,
  'completable-future': completableFutureSim,
  'java8-features': java8Sim,
  'java17-features': java17Sim,
  'java-memory-model': javaMemoryModelSim,
  'java-coding-standards': codingStandardsSim,
  'reactive-programming': reactiveSim,
  // MCP
  'mcp-deep-dive': mcpDeepDiveSim,
  // Auth0
  'auth0-deep-dive': auth0DeepDiveSim,
  // Docker
  'docker-fundamentals': dockerFundamentalsSim,
  'docker-spring-boot': dockerSpringBootSim,
  'docker-compose': dockerComposeSim,
  // LLD
  'lld-thinking-framework': microservicesPatternsSim,
  'lld-elevator': loadBalancerSim,
  'lld-snake-ladder': parkingLotSim,
  'lld-bookmyshow': paymentGatewaySim,
  'lld-splitwise': distributedTransactionsSim,
  'lld-library': databaseDecisionsSim,
  'lld-vending-machine': atmSim,
  'lld-chess': parkingLotSim,
};
