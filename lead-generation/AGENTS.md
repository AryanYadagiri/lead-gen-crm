# Project AI Agent Guide: Dynamic Lead Gen & Outreach Backend

This document dictates the architectural style and tool-selection autonomy for AI agents working in this repository.

## 🛠️ Tech Stack & Dependency Autonomy
* **Base Runtime:** Detect the current active Java version and Spring Boot parent framework version directly from the project's build file (`pom.xml` or `build.gradle`). Always align generated code with those syntax capabilities.
* **Dependency Permission:** You are explicitly **PERMITTED and ENCOURAGED** to add external, production-ready dependencies to the build file if required to build a feature safely.
* **Dependency Validation Rules:**
    1. Always query/check for the **latest stable, non-vulnerable version** of a library before adding it.
    2. Do NOT hardcode arbitrary version numbers if the dependency can be managed via an existing Spring Boot BOM (Bill of Materials) or Starter package.
    3. Avoid adding overlapping libraries (e.g., do not add Apache HttpClient if Spring's native `RestClient` or an active WebClient can fulfill the request).

## 2. Mandatory Documentation References
- Before building or refactoring any API endpoint routes, you **MUST reference official Spring documentation**.
- For REST validation, cross-origin mapping, and controller routing rules, cross-reference data points using:
  - **Live MCP Server:** Utilize the active `springdocs` toolset (`search_spring_docs`, `get_spring_guide`) to pull real-time API specifications.
  - **Web Anchors:** If offline or handling edge-case patterns, fetch guidelines from the official reference manual at [Spring Boot Documentation Portal](https://spring.io).
- For database query engineering and dynamic filtering parameters (like processing multi-value criteria array lists), explicitly follow specifications from [Spring Data JPA Reference Manual](https://spring.io).

## 🚀 Maven Execution & Discovery Commands
* **Check current dependencies:** Execute `./mvnw dependency:tree` to check if a library already exists before adding a duplicate.
* **Verify dependency injection & compilation:** After editing `pom.xml`, always run `./mvnw clean compile` to force a repository sync and verify there are no compilation errors.
* **Run Test Suite:** Before marking a task as done, run `./mvnw test` to ensure new dependencies didn't break existing lead generation or outreach flows.

## 🏗️ Architectural & Resilience Directives
1. **Dynamic Integrations:** When constructing clients for Apollo.io or Meta WhatsApp APIs, adapt to the active Spring Boot ecosystem version found in the project. Leverage built-in HTTP clients first.
2. **Resilience & Rate Limiting:** If building the Apollo.io lead scraper or WhatsApp outbound system, you are authorized to pull in standard resilience libraries (e.g., Resilience4j) if built-in mechanisms are insufficient to handle HTTP 429 backoff natively.
3. **Distributed Cron Safety:** When implementing background follow-up tasks, if the system is intended for multi-node execution, you must introduce a distributed lock provider (e.g., ShedLock) to the build configurations to prevent duplicate email/WhatsApp fires.
4. **Asynchronous Execution:** Ensure heavy IO tasks (sending communications, fetching external pages) run on decoupled thread pools. Optimize thread pools using modern features (like Virtual Threads) if the detected Java runtime supports them.

## 🗄️ Database Protection
* Implement natural unique keys or graceful constraint catching (`DataIntegrityViolationException`) to cleanly avoid duplicate lead entries from Apollo.io.
* Automatically generate database index migrations for any fields frequently scanned by background schedulers.
