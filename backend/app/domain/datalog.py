"""Formal Datalog Policy Engine (FORGE §4, §5).

Pure, deterministic evaluation of Datalog facts and rules using fixed-point iteration.
Conforms to strict domain layering (no I/O, no DB, no network, no datetime.now).
"""
from dataclasses import dataclass
from typing import Any, Sequence


@dataclass(frozen=True)
class Fact:
    predicate: str
    args: tuple[Any, ...]

    def __repr__(self) -> str:
        args_str = ", ".join(repr(a) for a in self.args)
        return f"{self.predicate}({args_str})"


@dataclass(frozen=True)
class NegatedFact:
    predicate: str
    args: tuple[Any, ...]

    def __repr__(self) -> str:
        args_str = ", ".join(repr(a) for a in self.args)
        return f"not {self.predicate}({args_str})"


@dataclass(frozen=True)
class Rule:
    head: Fact
    body: tuple[Fact | NegatedFact, ...]

    def __repr__(self) -> str:
        body_str = ", ".join(repr(b) for b in self.body)
        return f"{self.head} :- {body_str}."


def is_var(term: Any) -> bool:
    """Returns True if the term is a logical variable (?var or pure uppercase letter(s)).

    Constants like 'E102', 'AG102', 'D-claims-synth' containing numbers or hyphens are treated as constants.
    """
    if not isinstance(term, str):
        return False
    if term.startswith("?"):
        return True
    if any(c.isdigit() or c in "-_." for c in term):
        return False
    return term.isupper()


def unify_terms(term_pattern: Any, term_constant: Any, env: dict[str, Any]) -> dict[str, Any] | None:
    if is_var(term_pattern):
        var_name = term_pattern
        if var_name in env:
            return env if env[var_name] == term_constant else None
        new_env = dict(env)
        new_env[var_name] = term_constant
        return new_env
    else:
        return env if term_pattern == term_constant else None


def match_fact(fact_pattern: Fact, concrete_fact: Fact, env: dict[str, Any]) -> dict[str, Any] | None:
    if fact_pattern.predicate != concrete_fact.predicate:
        return None
    if len(fact_pattern.args) != len(concrete_fact.args):
        return None

    current_env = env
    for p_arg, c_arg in zip(fact_pattern.args, concrete_fact.args):
        res = unify_terms(p_arg, c_arg, current_env)
        if res is None:
            return None
        current_env = res
    return current_env


def instantiate_fact(fact_pattern: Fact, env: dict[str, Any]) -> Fact | None:
    instantiated_args = []
    for arg in fact_pattern.args:
        if is_var(arg):
            if arg not in env:
                return None
            instantiated_args.append(env[arg])
        else:
            instantiated_args.append(arg)
    return Fact(predicate=fact_pattern.predicate, args=tuple(instantiated_args))


class DatalogEngine:
    """Bottom-up fixed-point evaluator for Datalog programs."""

    def __init__(self, facts: Sequence[Fact] | None = None, rules: Sequence[Rule] | None = None):
        self.edb_facts: set[Fact] = set(facts) if facts else set()
        self.rules: list[Rule] = list(rules) if rules else []

    def add_fact(self, predicate: str, *args: Any) -> None:
        self.edb_facts.add(Fact(predicate, tuple(args)))

    def add_rule(self, head: Fact, *body: Fact | NegatedFact) -> None:
        self.rules.append(Rule(head=head, body=tuple(body)))

    def evaluate(self, max_iterations: int = 100) -> set[Fact]:
        """Evaluates all rules over the EDB facts until reaching a fixed point."""
        known_facts: set[Fact] = set(self.edb_facts)

        for _ in range(max_iterations):
            derived_in_iteration: set[Fact] = set()

            for rule in self.rules:
                # Solve rule body with current known facts
                env_solutions = self._solve_body(rule.body, known_facts)
                for env in env_solutions:
                    derived_fact = instantiate_fact(rule.head, env)
                    if derived_fact and derived_fact not in known_facts:
                        derived_in_iteration.add(derived_fact)

            if not derived_in_iteration:
                # Fixed point reached: no new facts derived
                break

            known_facts.update(derived_in_iteration)

        return known_facts

    def _solve_body(
        self,
        clauses: tuple[Fact | NegatedFact, ...],
        known_facts: set[Fact],
        current_env: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        if current_env is None:
            current_env = {}

        if not clauses:
            return [current_env]

        first_clause = clauses[0]
        remaining_clauses = clauses[1:]

        solutions: list[dict[str, Any]] = []

        if isinstance(first_clause, NegatedFact):
            # Closed-world assumption negation:
            # instantiate with current env bindings if available
            negated_fact_pattern = Fact(first_clause.predicate, first_clause.args)
            # Find if any known fact matches this negated pattern under current_env
            matches = []
            for concrete in known_facts:
                matched_env = match_fact(negated_fact_pattern, concrete, current_env)
                if matched_env is not None:
                    matches.append(matched_env)

            # If no matches exist, the negation holds
            if not matches:
                solutions.extend(self._solve_body(remaining_clauses, known_facts, current_env))
        else:
            # Positive clause: find all known facts matching the pattern
            for concrete in known_facts:
                extended_env = match_fact(first_clause, concrete, current_env)
                if extended_env is not None:
                    solutions.extend(self._solve_body(remaining_clauses, known_facts, extended_env))

        return solutions

    def query(self, predicate: str, *args: Any) -> list[tuple[Any, ...]]:
        """Queries the engine for facts matching the predicate and patterns."""
        all_facts = self.evaluate()
        results: list[tuple[Any, ...]] = []
        pattern = Fact(predicate, tuple(args))
        for fact in all_facts:
            env = match_fact(pattern, fact, {})
            if env is not None:
                results.append(fact.args)
        return results

    def is_true(self, predicate: str, *args: Any) -> bool:
        """Checks if a concrete ground fact holds under the fixed point."""
        all_facts = self.evaluate()
        target = Fact(predicate, tuple(args))
        return target in all_facts
