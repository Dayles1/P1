/**
 * The character's health, mana and stamina. Blows from creatures, long
 * falls and running out of air take health away; food, bandages and
 * potions give it back, and it slowly comes back by itself a while after
 * the last hurt. Armour (and the hero's defence) takes part of every
 * blow off: the more points, the less gets through, never all of it.
 *
 * Mana pays for the class skill and refills by itself; stamina is spent
 * running, jumping and swinging and comes back quickly while resting.
 * How much of each there can be, and how fast they come back, follow the
 * hero's attributes (see hero.ts).
 */

import type { Derived } from '../hero';

/** Health of a character from before heroes. */
export const MAX_HEALTH = 100;

/** Seconds after the last hurt before health starts coming back. */
const REGEN_DELAY = 8;
/** Seconds after the last effort before stamina starts coming back. */
const REST_DELAY = 0.8;

/** Share of a blow that gets through the given armour points. */
export function throughArmor(points: number): number {
    return 1 - points / (points + 25);
}

export class Vitals {
    maxHealth = MAX_HEALTH;
    maxMana = 0;
    maxStamina = 100;
    health = MAX_HEALTH;
    mana = 0;
    stamina = 100;
    /** Share of every blow that is taken (a tank's guard lowers it). */
    damageTaken = 1;
    /** Share of every blow not taken (the iron skin skill). */
    block = 0;
    /** Takes no harm at all (the creative tab's immortality). */
    invulnerable = false;
    private healthRegen = 0.8;
    private manaRegen = 0;
    private staminaRegen = 12;
    private sinceHurt = REGEN_DELAY;
    private sinceEffort = REST_DELAY;

    get dead(): boolean {
        return this.health <= 0;
    }

    /**
     * Takes the hero's maxima and regeneration; what was there keeps its
     * share (levelling up does not empty anything).
     */
    apply(derived: Derived): void {
        const share = (value: number, most: number) =>
            most > 0 ? value / most : 1;
        const health = share(this.health, this.maxHealth);
        const mana = share(this.mana, this.maxMana);
        const stamina = share(this.stamina, this.maxStamina);

        this.maxHealth = derived.health;
        this.maxMana = derived.mana;
        this.maxStamina = derived.stamina;
        this.healthRegen = derived.healthRegen;
        this.manaRegen = derived.manaRegen;
        this.staminaRegen = derived.staminaRegen;

        if (!this.dead) {
            this.health = Math.max(1, health * this.maxHealth);
        }

        this.mana = mana * this.maxMana;
        this.stamina = stamina * this.maxStamina;
    }

    /** Takes a blow, less what the armour stops. Answers the damage done. */
    hurt(amount: number, armor = 0): number {
        if (this.dead || amount <= 0 || this.invulnerable) {
            return 0;
        }

        const damage = Math.min(
            this.health,
            amount * throughArmor(armor) * this.damageTaken * (1 - this.block),
        );
        this.health -= damage;
        this.sinceHurt = 0;

        return damage;
    }

    /** Answers how much it healed (nothing at full health). */
    heal(amount: number): number {
        if (this.dead) {
            return 0;
        }

        const healed = Math.min(this.maxHealth - this.health, amount);
        this.health += healed;

        return healed;
    }

    /** Answers how much mana came back. */
    restoreMana(amount: number): number {
        const restored = Math.min(this.maxMana - this.mana, amount);
        this.mana += restored;

        return restored;
    }

    /** Spends mana; false (and nothing spent) when there is not enough. */
    spendMana(amount: number): boolean {
        if (this.mana < amount) {
            return false;
        }

        this.mana -= amount;

        return true;
    }

    /** Spends stamina, as far as there is; answers whether there was any. */
    tire(amount: number): boolean {
        if (this.stamina <= 0) {
            return false;
        }

        this.stamina = Math.max(0, this.stamina - amount);
        this.sinceEffort = 0;

        return true;
    }

    /** Health, mana and stamina creeping back. */
    update(dt: number): void {
        this.sinceHurt += dt;
        this.sinceEffort += dt;

        if (this.dead) {
            return;
        }

        if (this.sinceHurt >= REGEN_DELAY && this.health < this.maxHealth) {
            this.health = Math.min(
                this.maxHealth,
                this.health + this.healthRegen * dt,
            );
        }

        this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt);

        if (this.sinceEffort >= REST_DELAY) {
            this.stamina = Math.min(
                this.maxStamina,
                this.stamina + this.staminaRegen * dt,
            );
        }
    }

    /** Back to full health, as after waking up again (or a saved amount). */
    revive(health = Infinity): void {
        this.health = Math.max(1, Math.min(this.maxHealth, health));
        this.stamina = this.maxStamina;
        this.sinceHurt = REGEN_DELAY;
    }

    /** Everything full: a level reached. */
    refill(): void {
        this.health = this.maxHealth;
        this.mana = this.maxMana;
        this.stamina = this.maxStamina;
    }
}
