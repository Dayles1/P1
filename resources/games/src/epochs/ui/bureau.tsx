import type { BlueprintDef } from '../engine/content/types';
import type { Game } from '../engine/sim/game';
import { CostLine, Modal } from './common';

function Swatches({ blueprint }: { blueprint: BlueprintDef }) {
    return (
        <span className="blueprint__swatches">
            {Object.entries(blueprint.colors).map(([key, color]) => (
                <span key={key} style={{ background: color }} title={key} />
            ))}
        </span>
    );
}

/**
 * The Architects' Bureau: blueprints to unlock. An unlocked blueprint is
 * applied to a building from its card (🎨 Облик здания).
 */
export function Bureau({ game, onClose }: { game: Game; onClose: () => void }) {
    const bureau = game.bureau;
    const tier = bureau?.level ?? 0;
    const blueprints = game.content.blueprints.filter(
        (blueprint) =>
            game.content.epochOrder(blueprint.epoch) <= game.state.epoch + 1,
    );

    return (
        <Modal title="Бюро архитекторов" onClose={onClose} wide>
            <p className="tech-modal__lead">
                {bureau
                    ? `Бюро уровня ${tier}. Откройте чертёж, затем выберите здание и примените его в разделе «🎨 Облик здания» — там же можно перекрасить стены и крышу.`
                    : 'Постройте бюро архитекторов (раздел «Город»), чтобы открывать чертежи и менять облик зданий.'}
            </p>
            <div className="blueprint-grid">
                {blueprints.map((blueprint) => {
                    const unlocked = game.state.blueprints.includes(
                        blueprint.id,
                    );
                    const lock = unlocked
                        ? null
                        : game.blueprintLock(blueprint);
                    const fits = blueprint.buildings.length
                        ? blueprint.buildings
                              .map((id) =>
                                  game.content.hasBuilding(id)
                                      ? game.content.building(id).icon
                                      : id,
                              )
                              .join(' ')
                        : 'любые здания';

                    return (
                        <article
                            key={blueprint.id}
                            className={`blueprint${unlocked ? ' blueprint--done' : ''}${lock ? ' blueprint--locked' : ''}`}
                        >
                            <header>
                                <span className="blueprint__icon">
                                    {blueprint.icon}
                                </span>
                                <div>
                                    <b>{blueprint.name}</b>
                                    <small>
                                        {
                                            game.content.epochById(
                                                blueprint.epoch,
                                            ).name
                                        }{' '}
                                        · бюро ур. {blueprint.tier}
                                    </small>
                                </div>
                            </header>
                            <Swatches blueprint={blueprint} />
                            <p>{blueprint.description}</p>
                            <p className="blueprint__fits">
                                Для: {fits}
                                {blueprint.roof &&
                                    ` · крыша: ${blueprint.roof}`}
                            </p>
                            <footer>
                                {unlocked ? (
                                    <span className="tech-card__done">
                                        ✓ Чертёж готов
                                    </span>
                                ) : (
                                    <>
                                        <CostLine
                                            game={game}
                                            cost={blueprint.cost}
                                        />
                                        <button
                                            type="button"
                                            className="hud-button hud-button--primary"
                                            disabled={
                                                Boolean(lock) ||
                                                !game.canAfford(blueprint.cost)
                                            }
                                            title={lock ?? ''}
                                            onClick={() =>
                                                game.unlockBlueprint(
                                                    blueprint.id,
                                                )
                                            }
                                        >
                                            📐 Открыть
                                        </button>
                                    </>
                                )}
                            </footer>
                            {lock && (
                                <small className="blueprint__lock">
                                    🔒 {lock}
                                </small>
                            )}
                        </article>
                    );
                })}
            </div>
        </Modal>
    );
}
