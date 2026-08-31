# Tool Failure Handling

English | [Chinese](tool-failure-zh.md)

1. Read the complete error output and determine whether the cause is the command, path, project, dependency, permission, sandbox, network, or external service.
2. Correct the identified cause before retrying. Do not repeat the same failing call unchanged.
3. Fix and verify locally resolvable problems. Request authorization according to the environment rules when permission or network access is required.
4. Before switching tools, explain why the original tool is unsuitable and preserve equivalent verification coverage.
5. If completion remains impossible, report the missing step, available evidence, risk, and a concrete next action the user can take.
