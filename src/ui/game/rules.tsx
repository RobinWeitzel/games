import { useNav, Screen } from '../nav';
import { Row, Section } from '../components';
import { IconBook } from '../icons';
import './game.css';

/**
 * A game's rules, shown on its "How to Play" screen. Every game must have them
 * (`GameModule.rules`, checked by `validateRegistry`) and show `<HowToPlayRow/>` on its hub.
 *
 * Write short, plain sentences: what the goal is, how a move works, how you win (and lose),
 * what the modes and tools do. One sentence or short paragraph per entry.
 */
export interface RuleSection {
  header: string;
  rules: string[];
}
export type GameRules = RuleSection[];

/** Hub row that opens the rules. Place it right above `<StatsRow/>`. */
export function HowToPlayRow(props: { rules: GameRules; gameName: string }) {
  const nav = useNav();
  return (
    <Section>
      <Row
        icon={<IconBook size={16} />}
        iconBg="#ff9f0a"
        title="How to Play"
        chevron
        onClick={() => nav.push(<RulesScreen rules={props.rules} backLabel={props.gameName} />)}
      />
    </Section>
  );
}

/** Detail screen listing the rules, one inset-grouped section per topic. */
export function RulesScreen(props: { rules: GameRules; backLabel: string }) {
  return (
    <Screen title="How to Play" back={props.backLabel}>
      {props.rules.map((s) => (
        <Section key={s.header} header={s.header}>
          {s.rules.map((r, i) => (
            <p key={i} class="rule">
              {r}
            </p>
          ))}
        </Section>
      ))}
    </Screen>
  );
}
