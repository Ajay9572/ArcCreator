/* ArcParser: turns a free-text prompt (or a precise "A -> B -> C" DSL) into
   a { nodes, edges } graph, matching known architecture vocabulary to icons. */

const ArcParser = (() => {
  // Longest-phrase-first dictionary: {text, type, label}
  const RAW_DICTIONARY = [
    // databases
    ['postgresql', 'database', 'PostgreSQL'], ['postgres', 'database', 'PostgreSQL'], ['psql', 'database', 'PostgreSQL'],
    ['mysql', 'database', 'MySQL'], ['mongodb', 'database', 'MongoDB'], ['mongo', 'database', 'MongoDB'],
    ['dynamodb', 'database', 'DynamoDB'], ['cassandra', 'database', 'Cassandra'],
    ['sql server', 'database', 'SQL Server'], ['mssql', 'database', 'SQL Server'],
    ['oracle db', 'database', 'Oracle DB'], ['sqlite', 'database', 'SQLite'],
    ['relational database', 'database', 'Database'], ['sql database', 'database', 'Database'],
    ['nosql database', 'database', 'Database'], ['database', 'database', 'Database'], [' db ', 'database', 'Database'],
    // cache
    ['redis', 'cache', 'Redis'], ['memcached', 'cache', 'Memcached'], ['cache', 'cache', 'Cache'],
    // queue / messaging
    ['kafka', 'queue', 'Kafka'], ['rabbitmq', 'queue', 'RabbitMQ'], ['sqs', 'queue', 'SQS'],
    ['message broker', 'queue', 'Message Broker'], ['message queue', 'queue', 'Queue'],
    ['pub/sub', 'queue', 'Pub/Sub'], ['pubsub', 'queue', 'Pub/Sub'], ['queue', 'queue', 'Queue'],
    // storage
    ['amazon s3', 'storage', 'S3'], ['s3 bucket', 'storage', 'S3'], ['s3', 'storage', 'S3'],
    ['blob storage', 'storage', 'Blob Storage'], ['object storage', 'storage', 'Storage'],
    ['storage bucket', 'storage', 'Storage'], ['bucket', 'storage', 'Storage'], ['storage', 'storage', 'Storage'],
    // cdn / dns
    ['cloudfront', 'cdn', 'CloudFront'], ['cloudflare', 'cdn', 'Cloudflare'], ['cdn', 'cdn', 'CDN'],
    ['route 53', 'dns', 'Route 53'], ['route53', 'dns', 'Route 53'], ['dns', 'dns', 'DNS'],
    // load balancer / gateway
    ['load balancer', 'loadbalancer', 'Load Balancer'], ['loadbalancer', 'loadbalancer', 'Load Balancer'],
    ['elb', 'loadbalancer', 'Load Balancer'], ['alb', 'loadbalancer', 'Load Balancer'],
    ['api gateway', 'gateway', 'API Gateway'], ['apigateway', 'gateway', 'API Gateway'], ['api gw', 'gateway', 'API Gateway'],
    // security
    ['firewall', 'firewall', 'Firewall'], ['waf', 'firewall', 'Firewall'], ['security group', 'firewall', 'Firewall'],
    // functions / containers
    ['aws lambda', 'function', 'Lambda'], ['lambda', 'function', 'Lambda'],
    ['cloud function', 'function', 'Cloud Function'], ['azure function', 'function', 'Azure Function'],
    ['serverless function', 'function', 'Function'], ['serverless', 'function', 'Function'],
    ['kubernetes', 'kubernetes', 'Kubernetes'], ['k8s', 'kubernetes', 'Kubernetes'],
    ['eks', 'kubernetes', 'Kubernetes'], ['aks', 'kubernetes', 'Kubernetes'], ['gke', 'kubernetes', 'Kubernetes'],
    ['docker', 'container', 'Container'], ['container', 'container', 'Container'],
    // monitoring / auth / network / notification / analytics / ml
    ['cloudwatch', 'monitoring', 'CloudWatch'], ['datadog', 'monitoring', 'Datadog'],
    ['prometheus', 'monitoring', 'Prometheus'], ['grafana', 'monitoring', 'Grafana'],
    ['monitoring', 'monitoring', 'Monitoring'], ['logging', 'monitoring', 'Logging'], ['metrics', 'monitoring', 'Monitoring'],
    ['auth0', 'auth', 'Auth0'], ['cognito', 'auth', 'Cognito'], ['okta', 'auth', 'Okta'],
    ['identity provider', 'auth', 'Identity Provider'], ['auth service', 'auth', 'Auth Service'],
    ['authentication', 'auth', 'Auth'], ['oauth', 'auth', 'OAuth'], ['sso', 'auth', 'SSO'], ['auth', 'auth', 'Auth'],
    ['vpc', 'network', 'VPC'], ['subnet', 'network', 'Subnet'], ['network', 'network', 'Network'],
    ['notification service', 'notification', 'Notifications'], ['email service', 'notification', 'Email Service'],
    ['sms service', 'notification', 'SMS Service'], ['sns', 'notification', 'SNS'], ['notification', 'notification', 'Notifications'],
    ['data warehouse', 'analytics', 'Data Warehouse'], ['bigquery', 'analytics', 'BigQuery'],
    ['redshift', 'analytics', 'Redshift'], ['snowflake', 'analytics', 'Snowflake'], ['analytics', 'analytics', 'Analytics'],
    ['machine learning model', 'ml', 'ML Model'], ['machine learning', 'ml', 'ML Model'],
    ['ml model', 'ml', 'ML Model'], ['ai model', 'ml', 'ML Model'], ['ml service', 'ml', 'ML Model'],
    // clients
    ['ios app', 'mobile', 'Mobile App'], ['android app', 'mobile', 'Mobile App'],
    ['mobile app', 'mobile', 'Mobile App'], ['mobile client', 'mobile', 'Mobile App'],
    ['web browser', 'browser', 'Browser'],
    ['react app', 'browser', 'Frontend'], ['react', 'browser', 'Frontend'], ['vue', 'browser', 'Frontend'],
    ['angular', 'browser', 'Frontend'], ['single page app', 'browser', 'Frontend'], ['spa', 'browser', 'Frontend'],
    ['web app', 'browser', 'Frontend'], ['webapp', 'browser', 'Frontend'], ['frontend', 'browser', 'Frontend'],
    ['client app', 'browser', 'Frontend'], ['browser', 'browser', 'Browser'],
    ['end user', 'user', 'User'], ['end-user', 'user', 'User'], ['customer', 'user', 'User'],
    ['user', 'user', 'User'], ['client', 'user', 'Client'],
    // compute / services
    ['node.js api', 'microservice', 'Node.js Service'], ['node.js', 'microservice', 'Node.js Service'],
    ['nodejs', 'microservice', 'Node.js Service'], ['express', 'microservice', 'Express Service'],
    ['django', 'microservice', 'Django Service'], ['flask', 'microservice', 'Flask Service'],
    ['spring boot', 'microservice', 'Spring Service'], ['spring', 'microservice', 'Spring Service'],
    ['.net core', 'microservice', '.NET Service'], ['dotnet', 'microservice', '.NET Service'],
    ['backend service', 'microservice', 'Service'], ['backend api', 'microservice', 'Service'],
    ['api service', 'microservice', 'Service'], ['microservice', 'microservice', 'Service'],
    ['backend', 'microservice', 'Service'],
    ['web server', 'server', 'Web Server'], ['webserver', 'server', 'Web Server'],
    ['nginx', 'server', 'Web Server'], ['apache', 'server', 'Web Server'], ['http server', 'server', 'Web Server'],
    ['app server', 'server', 'Server'], ['server', 'server', 'Server'], ['service', 'microservice', 'Service'],
    // cloud
    ['amazon web services', 'cloud', 'Cloud'], ['google cloud', 'cloud', 'Cloud'],
    ['microsoft azure', 'cloud', 'Cloud'], ['aws', 'cloud', 'Cloud'], ['azure', 'cloud', 'Cloud'],
    ['gcp', 'cloud', 'Cloud'], ['cloud', 'cloud', 'Cloud']
  ].map(([text, type, label]) => ({ text: text.trim(), type, label }));

  RAW_DICTIONARY.sort((a, b) => b.text.length - a.text.length);

  const CONNECTORS = [
    'reads and writes to', 'reads from and writes to', 'sends requests to', 'routes requests to',
    'publishes messages to', 'communicates with', 'authenticates with', 'authenticates via',
    'caches results in', 'stores data in', 'subscribes to', 'consumes from', 'retrieves from',
    'forwards to', 'connects to', 'talks to', 'writes to', 'reads from', 'caches in',
    'publishes to', 'routes to', 'fetches from', 'pushes to', 'pulls from', 'sends to',
    'queries', 'invokes', 'calls', 'monitors', 'logs to'
  ].sort((a, b) => b.length - a.length);

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function findMatches(text, phrases) {
    const lower = text.toLowerCase();
    const wordish = /[a-z0-9]/i;
    const matches = [];
    let i = 0;
    while (i < lower.length) {
      let matched = null;
      for (const p of phrases) {
        const t = p.text || p;
        if (!t) continue;
        if (lower.startsWith(t, i)) {
          const before = i === 0 ? ' ' : lower[i - 1];
          const okBefore = !wordish.test(before) || !wordish.test(t[0]);
          if (!okBefore) continue;
          let end = i + t.length;
          const next = end >= lower.length ? '' : lower[end];
          let okAfter = !wordish.test(next) || !wordish.test(t[t.length - 1]);
          // tolerate a simple trailing plural ("notifications" matching "notification")
          if (!okAfter && next === 's') {
            const afterS = end + 1 >= lower.length ? '' : lower[end + 1];
            if (!wordish.test(afterS)) { okAfter = true; end += 1; }
          }
          if (okAfter) { matched = { entry: p, start: i, end, text: lower.slice(i, end) }; break; }
        }
      }
      if (matched) { matches.push(matched); i = matched.end; }
      else i++;
    }
    return matches;
  }

  // Bare category words that should collapse into a neighboring specific
  // match instead of becoming their own node (e.g. "PostgreSQL database",
  // "Kafka queue", "Redis cache" -> one node, not two).
  const GENERIC_ENTITY_LABELS = new Set(['Database', 'Cache', 'Queue', 'Server', 'Service', 'Storage', 'Container']);

  function findEntityMatches(text) {
    const raw = findMatches(text, RAW_DICTIONARY);
    const merged = [];
    for (const cur of raw) {
      const prev = merged[merged.length - 1];
      if (prev && prev.entry.type === cur.entry.type && /^\s*$/.test(text.slice(prev.end, cur.start))) {
        const prevGeneric = GENERIC_ENTITY_LABELS.has(prev.entry.label);
        const curGeneric = GENERIC_ENTITY_LABELS.has(cur.entry.label);
        if (prevGeneric !== curGeneric) {
          const specific = prevGeneric ? cur : prev;
          merged[merged.length - 1] = { entry: specific.entry, start: prev.start, end: cur.end, text: text.slice(prev.start, cur.end) };
          continue;
        }
      }
      merged.push(cur);
    }
    return merged;
  }

  function titleCase(connectorText) {
    return connectorText.replace(/\b\w/g, c => c.toUpperCase());
  }

  function slug(label) { return label.trim().toLowerCase().replace(/\s+/g, ' '); }

  class GraphBuilder {
    constructor() {
      this.nodes = [];
      this.nodeIndex = new Map(); // label-key -> node
      this.edges = [];
      this.edgeKeys = new Set();
      this._id = 0;
      this.currentGroup = null;
    }
    getOrCreateNode(label, type) {
      const key = slug(label);
      if (this.nodeIndex.has(key)) {
        const existing = this.nodeIndex.get(key);
        if (this.currentGroup && !existing.group) existing.group = this.currentGroup;
        return existing;
      }
      const node = { id: 'n' + (this._id++), label, type, group: this.currentGroup || null };
      this.nodes.push(node);
      this.nodeIndex.set(key, node);
      return node;
    }
    hasEdgeBetween(a, b) {
      return this.edges.some(e => (e.source === a && e.target === b) || (e.source === b && e.target === a));
    }
    addEdge(sourceId, targetId, label, style) {
      if (sourceId === targetId) return;
      const key = sourceId + '>' + targetId + '>' + (label || '');
      if (this.edgeKeys.has(key)) return;
      this.edgeKeys.add(key);
      this.edges.push({ id: 'e' + this.edges.length, source: sourceId, target: targetId, label: label || '', style: style === 'dashed' ? 'dashed' : 'solid' });
    }
  }

  function parseArrowLine(line, gb) {
    // e.g. "User -> Web App -> API, Cache", "A => B", or "A -.-> B" for a
    // dashed connection (Mermaid-style dotted-arrow syntax).
    const tokens = line.split(/(-\.->|-{1,2}>|=>)/).map(s => s.trim()).filter(s => s !== '');
    if (tokens.length < 3) return false;
    let prevNodes = expandTargets(tokens[0], gb);
    for (let i = 1; i < tokens.length - 1; i += 2) {
      const style = tokens[i] === '-.->' ? 'dashed' : 'solid';
      const currNodes = expandTargets(tokens[i + 1], gb);
      for (const p of prevNodes) for (const c of currNodes) gb.addEdge(p.id, c.id, '', style);
      prevNodes = currNodes;
    }
    return true;
  }

  function expandTargets(text, gb) {
    return text.split(/,| and /i).map(s => s.trim()).filter(Boolean).map(label => {
      const found = findEntityMatches(label);
      if (found.length && found[0].start === 0 && found[0].end >= label.length - 1) {
        return gb.getOrCreateNode(found[0].entry.label, found[0].entry.type);
      }
      return gb.getOrCreateNode(toDisplayLabel(label), 'generic');
    });
  }

  function toDisplayLabel(s) {
    const t = s.trim();
    if (!t) return 'Component';
    return t.length > 28 ? t.slice(0, 27) + '…' : t.replace(/\b\w/g, c => c.toUpperCase());
  }

  function parseSentence(sentence, gb) {
    const connectorMatches = findMatches(sentence, CONNECTORS.map(c => ({ text: c })));
    // A connector phrase wins over an entity match on the same text — e.g. the
    // verb "caches" in "caches results in Redis" must not also register as a
    // spurious "Cache" node just because it shares a root with that noun.
    const entityMatches = findEntityMatches(sentence)
      .filter(m => !connectorMatches.some(cm => m.start < cm.end && cm.start < m.end));
    if (entityMatches.length === 0) return;

    // Every recognized entity becomes a node — even one a connector phrase
    // below doesn't directly reference. A sentence naming five things
    // shouldn't silently drop the two a connector didn't happen to touch.
    entityMatches.forEach(m => gb.getOrCreateNode(m.entry.label, m.entry.type));

    for (const cm of connectorMatches) {
      const before = entityMatches.filter(m => m.end <= cm.start);
      const after = entityMatches.filter(m => m.start >= cm.end);
      if (!before.length || !after.length) continue;
      const source = before[before.length - 1];
      const targets = [after[0]];
      // pull in additional targets chained by "and"/"," directly between them
      let idx = 1;
      while (idx < after.length) {
        const between = sentence.slice(after[idx - 1].end, after[idx].start);
        if (/^\s*(,|and|&)\s*$/i.test(between)) { targets.push(after[idx]); idx++; }
        else break;
      }
      const srcNode = gb.getOrCreateNode(source.entry.label, source.entry.type);
      const label = titleCase(cm.entry.text || cm.text);
      for (const t of targets) {
        const tgtNode = gb.getOrCreateNode(t.entry.label, t.entry.type);
        gb.addEdge(srcNode.id, tgtNode.id, label);
      }
    }

    // Fill in a plain connection between reading-order neighbors that no
    // connector phrase above already linked — keeps something like
    // "A, B and C talk to D" from leaving A and B stranded with no edge.
    let prev = null;
    for (const m of entityMatches) {
      const node = gb.getOrCreateNode(m.entry.label, m.entry.type);
      if (prev && !gb.hasEdgeBetween(prev.id, node.id)) gb.addEdge(prev.id, node.id, '');
      prev = node;
    }
  }

  function parse(promptText) {
    const gb = new GraphBuilder();
    const lines = promptText.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const arrowRe = /-{1,2}>|=>/;
    const groupRe = /^\[([^\]]{1,40})\]\s*(.*)$/;
    for (const rawLine of lines) {
      const groupMatch = rawLine.match(groupRe);
      const line = groupMatch ? groupMatch[2].trim() : rawLine;
      gb.currentGroup = groupMatch ? groupMatch[1].trim() : null;
      if (!line) continue;
      if (arrowRe.test(line)) {
        parseArrowLine(line, gb);
      } else {
        const sentences = line.split(/(?<=[.;!?])\s+|(?<=[.;!?])$/).map(s => s.trim()).filter(Boolean);
        if (sentences.length === 0) sentences.push(line);
        for (const s of sentences) parseSentence(s, gb);
      }
    }
    return { nodes: gb.nodes, edges: gb.edges };
  }

  return { parse };
})();

