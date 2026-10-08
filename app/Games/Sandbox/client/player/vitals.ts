/**
 * The character's health: blows from creatures, long falls and running
 * out of air take it away; food and bandages give it back, and it slowly
 * comes back by itself a while after the last hurt. Armour takes part of
 * every blow off: the more points, the less gets through, never all of it.
 */

export const MAX_HEALTH = 100;

/** Seconds after the last hurt before health starts coming back. */
const REGEN_DELAY = 8;
const REGEN_PER_SECOND = 0.8;

/** Share of a blow that gets through the given armour points. */
export function throughArmor(points: number): number {
    return 1 - points / (points + 25);
}

export class Vitals {
    health = MAX_HEALTH;
    private sinceHurt = REGEN_DELAY;

    get dead(): boolean {
        return this.health <= 0;
    }

    /** Takes a blow, less what the armour stops. Answers the damage done. */
    hurt(amount: number, armor = 0): number {
        if (this.dead || amount <= 0) {
            return 0;
        }

        const damage = Math.min(this.health, amount * throughArmor(armor));
        this.health -= damage;
        this.sinceHurt = 0;

        return damage;
    }

    /** Answers how much it healed (nothing at full health). */
    heal(amount: number): number {
        if (this.dead) {
            return 0;
        }

        const healed = Math.min(MAX_HEALTH - this.health, amount);
        this.health += healed;

        return healed;
    }

    /** Health creeping back. Answers whether it changed. */
    update(dt: number): boolean {
        this.sinceHurt += dt;

        if (
            this.dead ||
            this.sinceHurt < REGEN_DELAY ||
            this.health >= MAX_HEALTH
        ) {
            return false;
        }

        this.health = Math.min(MAX_HEALTH, this.health + REGEN_PER_SECOND * dt);

        return true;
    }

    /** Back to full, as after waking up again. */
    revive(health = MAX_HEALTH): void {
        this.health = Math.max(1, Math.min(MAX_HEALTH, health));
        this.sinceHurt = REGEN_DELAY;
    }
}
