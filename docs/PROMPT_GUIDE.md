# Writing prompts for ArcCreator

ArcCreator does **not** call an LLM to read your prompt — `js/parser.js`
(`ArcParser`) is a plain, deterministic dictionary-and-regex matcher. That's
good news and bad news: results are 100% reproducible (the same prompt always
produces the same diagram), but the parser only recognizes exactly what's in
its dictionary and only understands a few sentence shapes. This guide explains
those rules precisely, so you can write prompts that hit them on the first try
instead of getting a "No recognizable components found" or a diagram with
missing/merged/stray-connected nodes.

There are two input styles, and you can mix them on different **lines** of the
same prompt (the parser decides per line):

1. **Arrow syntax** — a line containing `->`, `-->`, `=>`, or `-.->`. Exact,
   predictable, best for control.
2. **Plain English** — everything else. Forgiving and reads naturally, but the
   matching rules below determine what actually gets drawn.

A `[Name]` prefix at the start of a line puts everything that line creates
into a labeled region box, regardless of which of the two styles the rest of
the line uses.

---

## 1. The vocabulary the parser knows

Plain English and arrow-syntax targets are only recognized if they match an
entry in the dictionary below (case-insensitive, whole-word). Anything else
becomes a plain gray "generic" box with your text as its label — which is
fine, just not icon-matched. Longer phrases are matched before shorter ones,
so `"api gateway"` is matched as one thing, not as "API" + "gateway".

| Category (icon)  | Specific terms → label shown                                                                                                                                                                                                                                                                   | Generic fallback terms → label shown                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Database         | postgresql / postgres / psql →**PostgreSQL**; mysql → **MySQL**; mongodb / mongo → **MongoDB**; dynamodb → **DynamoDB**; cassandra → **Cassandra**; sql server / mssql → **SQL Server**; oracle db → **Oracle DB**; sqlite → **SQLite** | database, sql database, nosql database, relational database, " db " →**Database**      |
| Cache            | redis →**Redis**; memcached → **Memcached**                                                                                                                                                                                                                                       | cache →**Cache**                                                                       |
| Queue            | kafka →**Kafka**; rabbitmq → **RabbitMQ**; sqs → **SQS**; pub/sub / pubsub → **Pub/Sub**; message broker → **Message Broker**                                                                                                                                | queue, message queue →**Queue**                                                        |
| Storage          | amazon s3 / s3 bucket / s3 →**S3**; blob storage → **Blob Storage**                                                                                                                                                                                                               | storage, object storage, storage bucket, bucket →**Storage**                           |
| CDN              | cloudfront →**CloudFront**; cloudflare → **Cloudflare**                                                                                                                                                                                                                           | cdn →**CDN**                                                                           |
| DNS              | route 53 / route53 →**Route 53**                                                                                                                                                                                                                                                         | dns →**DNS**                                                                           |
| Load balancer    | elb, alb →**Load Balancer**                                                                                                                                                                                                                                                              | load balancer, loadbalancer →**Load Balancer**                                         |
| Gateway          | —                                                                                                                                                                                                                                                                                              | api gateway, apigateway, api gw →**API Gateway**                                       |
| Firewall         | —                                                                                                                                                                                                                                                                                              | firewall, waf, security group →**Firewall**                                            |
| Function         | aws lambda / lambda →**Lambda**; cloud function → **Cloud Function**; azure function → **Azure Function**                                                                                                                                                                  | serverless function, serverless →**Function**                                          |
| Kubernetes       | k8s, eks, aks, gke, kubernetes →**Kubernetes**                                                                                                                                                                                                                                           | —                                                                                            |
| Container        | docker, container →**Container**                                                                                                                                                                                                                                                         | —                                                                                            |
| Monitoring       | cloudwatch →**CloudWatch**; datadog → **Datadog**; prometheus → **Prometheus**; grafana → **Grafana**                                                                                                                                                               | monitoring, logging, metrics →**Monitoring**                                           |
| Auth             | auth0 →**Auth0**; cognito → **Cognito**; okta → **Okta**; identity provider → **Identity Provider**; auth service → **Auth Service**                                                                                                                         | authentication, oauth, sso, auth →**Auth**                                             |
| Network          | vpc →**VPC**; subnet → **Subnet**                                                                                                                                                                                                                                                 | network →**Network**                                                                   |
| Notification     | sns →**SNS**; notification service, notification(s) → **Notifications**; email service → **Email Service**; sms service → **SMS Service**                                                                                                                           | —                                                                                            |
| Analytics        | bigquery →**BigQuery**; redshift → **Redshift**; snowflake → **Snowflake**; data warehouse → **Data Warehouse**                                                                                                                                                     | analytics →**Analytics**                                                               |
| ML               | machine learning (model), ml model, ai model, ml service →**ML Model**                                                                                                                                                                                                                   | —                                                                                            |
| Mobile           | ios app, android app, mobile app, mobile client →**Mobile App**                                                                                                                                                                                                                          | —                                                                                            |
| Browser/Frontend | web browser →**Browser**; react(app)/vue/angular/spa/single page app/web app/webapp/frontend/client app → **Frontend**                                                                                                                                                            | browser →**Browser**                                                                   |
| User             | end user, end-user, customer, user →**User**; client → **Client**                                                                                                                                                                                                                 | —                                                                                            |
| Service          | node.js(api)/nodejs →**Node.js Service**; express → **Express Service**; django → **Django Service**; flask → **Flask Service**; spring (boot) → **Spring Service**; .net core / dotnet → **.NET Service**                                            | backend service, backend api, api service, microservice, backend, service →**Service** |
| Server           | nginx, apache, http server, web server, webserver →**Web Server**                                                                                                                                                                                                                        | app server, server →**Server**                                                         |
| Cloud            | aws, azure, gcp, amazon web services, google cloud, microsoft azure →**Cloud**                                                                                                                                                                                                           | cloud →**Cloud**                                                                       |

**Connector phrases** — when one of these appears *between* two recognized
terms in a plain-English sentence, it becomes the (Title Cased) label on the
arrow between them:

> reads and writes to · reads from and writes to · sends requests to · routes
> requests to · publishes messages to · communicates with · authenticates
> with · authenticates via · caches results in · stores data in · subscribes
> to · consumes from · retrieves from · forwards to · connects to · talks to ·
> writes to · reads from · caches in · publishes to · routes to · fetches
> from · pushes to · pulls from · sends to · queries · invokes · calls ·
> monitors · logs to

If you don't use one of these phrases, entities are still connected — see
§3's "silent fallback edges" below — just without a label.

---

## 2. Arrow syntax

```
User -> API Gateway -> Service -> Database
Service -.-> Notifications
Service -> Cache, Queue
```

- `->`, `-->`, and `=>` all mean a **solid** arrow. `-.->` means **dashed**.
  No spaces are required around the arrow (`A->B` works).
- Chain as many hops as you like on one line: `A -> B -> C -> D`.
- Fan out to multiple targets from one source with a comma or `and`:
  `A -> B, C` or `A -> B and C` (do **not** rely on `and` inside a target's
  own name — it'll be treated as a separator).
- **Each segment is matched against the dictionary as a whole, from the
  start.** This is stricter than plain English: `Postgres` matches, but
  `My Postgres DB` does **not** — the recognized word isn't at position 0
  covering (almost) the whole segment, so the whole phrase falls back to a
  generic box labeled "My Postgres Db". Keep arrow-syntax segments to just
  the recognized term, or a short unrecognized name you're fine seeing as a
  plain box (put custom multi-word names in plain English mode instead, or
  add the icon afterward in the Properties panel).
- **A line with an arrow that doesn't fully parse produces nothing at all**
  for that line — it does not fall back to plain-English parsing. A trailing
  `A ->` with nothing after it, for example, is silently dropped. Always
  finish the arrow.

## 3. Plain English

```
A React frontend calls a Node.js API which reads from a PostgreSQL database
and caches results in Redis. The API publishes events to a Kafka queue that
triggers a notification service.
```

- Recognized terms can appear **anywhere** in the sentence — unlike arrow
  syntax, `"a PostgreSQL database"` matches fine (it isn't required to be the
  whole sentence).
- Text is split into sentences on `.`, `;`, `!`, `?` and each sentence is
  parsed independently — a connector only links entities *within the same
  sentence*. Don't spread one relationship across a period.
- **Adjacent same-category words merge into one node**, e.g. "PostgreSQL
  database" → one node labeled **PostgreSQL** (not a separate "PostgreSQL" box
  next to a "Database" box), because both words are in the `database`
  category and one of them ("database") is a bare generic term. This only
  merges when the two words are of the *same* dictionary category — "Redis
  database" (cache + database) stays as two separate nodes, which usually
  isn't what you meant. If you want one node, just say "Redis" or "Redis
  cache".
- **Every recognized entity in a sentence becomes a node**, even ones no
  connector phrase touches — so naming five things in one sentence draws all
  five.
- **Silent fallback edges**: within a sentence, any two recognized entities
  that end up next to each other in reading order and aren't already
  connected by a connector phrase get a plain, unlabeled edge automatically.
  This is convenient for a quick flow description, but in a sentence that
  lists several loosely related things it can draw connections you didn't
  intend. If that happens, either split the sentence in two or switch that
  part of the prompt to arrow syntax for exact control.
- A word used as a **verb** (e.g. "caches" in "caches results in Redis") is
  correctly treated as the connector, not also as a stray "Cache" node — the
  parser gives connector phrases priority over an overlapping entity match.
- Plurals are tolerated only as a trailing "s" — "notifications" matches
  "notification" fine; more irregular forms won't.

## 4. Region / group boxes

```
[Client] User -> Load Balancer
[Cloud Region] Load Balancer -> API Gateway -> Service -> Database
[Cloud Region] Service -> Cache
[Cloud Region] Service -> Queue -> Notifications
[Systems of Record] Auth Service
[Cloud Region] Service -> Auth Service
```

- Prefix a line with `[Name]` (up to 40 characters) to put every node that
  line touches into a labeled dashed box called `Name`.
- **The tag only applies to the line it's on.** To keep several lines in the
  same region, repeat `[Name]` at the start of every one of them (see the
  four `[Cloud Region]` lines above). A line with no tag creates nodes with no
  region.
- **A node's region sticks the first time it's set.** If `Load Balancer` is
  first created under `[Client]`, a later line that mentions `Load Balancer`
  under a different tag will *not* move it — `getOrCreateNode` only assigns a
  group when the node doesn't already have one. To move a node to a different
  region afterward, select it on the canvas and edit **Group / Region** in
  the Properties panel.
- Region boxes **auto-fit** their members by default. You can also:
  - **Drag the box's dashed body, or its name chip, to move the whole region**
    (and every node in it) together as a unit.
  - **Drag any of its four corner handles** to resize/reshape it manually —
    useful when auto-layout puts an unrelated node too close and boxes get
    cramped. A manual resize is remembered even as members move, until you
    double-click the name chip to reset it back to auto-fit.

## 5. Node identity and "Add to existing diagram"

- Two mentions of the exact same recognized label (case-insensitively; extra
  spaces collapsed) become **one node**, wherever in the prompt they appear —
  this is what lets `Service` appear in four different `[Cloud Region]` lines
  above and still be a single box with four connections.
- This also means two *different* things that happen to map to the same
  generic label will silently merge into one node. `backend` and
  `microservice` both map to the label **Service** — if you mention both in
  one prompt expecting two separate services, you'll get one. Give each a
  distinct, specific name instead (`Auth Service`, `Order Service`, or a
  named tech like `Django`) if you need them to stay separate.
- Turning on **Add to existing diagram** re-runs the parser on your new text
  and merges the result into the current canvas: a new node whose label
  matches an existing node (same case-insensitive rule) reuses it — including
  its position and region — instead of creating a duplicate; only genuinely
  new labels get added as new boxes. Duplicate edges are dropped
  automatically either way.

---

## Quick troubleshooting

| Symptom                                                     | Likely cause                                                                                                     | Fix                                                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| "No recognizable components found"                          | Nothing in the prompt matched the dictionary and it has no`->`                                                 | Add at least one term from §1, or switch to arrow syntax                                                                           |
| An arrow-syntax line produced nothing                       | The line had an arrow but fewer than 2 real segments (e.g. a dangling`A ->`)                                   | Make sure every arrow has a target after it                                                                                         |
| A descriptive arrow-syntax target didn't get the right icon | Arrow-syntax segments must match from the start;`"My Postgres DB"` doesn't, `"Postgres