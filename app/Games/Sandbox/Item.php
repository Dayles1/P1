<?php

namespace App\Games\Sandbox;

/**
 * Everything a player can carry. Values are the browser client's item ids
 * (client/items.ts); a stack never holds more than maxStack(), tools and
 * armour break after durability() uses, and armour is worn in its
 * armorSlot().
 */
enum Item: string
{
    case Wood = 'wood';
    case Stone = 'stone';
    case Stick = 'stick';
    case Pebble = 'pebble';
    case Berries = 'berries';
    case Mushroom = 'mushroom';
    case Fiber = 'fiber';
    case Flint = 'flint';
    case IronOre = 'iron_ore';
    case Iron = 'iron';
    case StoneAxe = 'stone_axe';
    case StonePickaxe = 'stone_pickaxe';
    case WoodSword = 'wood_sword';
    case StoneSword = 'stone_sword';
    case IronAxe = 'iron_axe';
    case IronPickaxe = 'iron_pickaxe';
    case IronSword = 'iron_sword';
    case Shovel = 'shovel';
    case Dagger = 'dagger';
    case WarHammer = 'war_hammer';
    case Staff = 'staff';
    case Torch = 'torch';
    case Campfire = 'campfire';
    case RawMeat = 'raw_meat';
    case CookedMeat = 'cooked_meat';
    case Hide = 'hide';
    case Bandage = 'bandage';
    case HealingPotion = 'healing_potion';
    case ManaPotion = 'mana_potion';
    case OldNotes = 'old_notes';
    case RelicShard = 'relic_shard';
    case LeatherHelmet = 'leather_helmet';
    case LeatherJacket = 'leather_jacket';
    case LeatherBoots = 'leather_boots';
    case IronHelmet = 'iron_helmet';
    case IronChestplate = 'iron_chestplate';
    case IronBoots = 'iron_boots';
    case Chest = 'chest';
    case Workbench = 'workbench';
    case WoodWall = 'wood_wall';
    case WoodDoor = 'wood_door';
    case WoodRoof = 'wood_roof';
    case StoneWall = 'stone_wall';
    case SleepingBag = 'sleeping_bag';
    case WindFeather = 'wind_feather';
    case SunStone = 'sun_stone';
    case FrostCrystal = 'frost_crystal';
    case ForestHeart = 'forest_heart';
    case GoldenClover = 'golden_clover';
    case StrengthRune = 'strength_rune';
    case AgilityRune = 'agility_rune';
    case SpiritRune = 'spirit_rune';
    case VitalShard = 'vital_shard';
    case ManaPearl = 'mana_pearl';
    case SwiftCharm = 'swift_charm';
    case StormEye = 'storm_eye';
    case DeepPearl = 'deep_pearl';
    case BloodRuby = 'blood_ruby';
    case PhoenixFeather = 'phoenix_feather';
    case Essence = 'essence';

    /**
     * Slots in the inventory.
     */
    public const int SLOTS = 24;

    /**
     * Where armour is worn.
     *
     * @var list<string>
     */
    public const array ARMOR_SLOTS = ['head', 'body', 'feet'];

    public function maxStack(): int
    {
        return match ($this) {
            self::Wood, self::Stone => 100,
            self::Stick, self::Pebble, self::Fiber, self::IronOre, self::Iron, self::Essence => 50,
            self::StrengthRune, self::AgilityRune, self::SpiritRune, self::VitalShard, self::ManaPearl, self::SwiftCharm => 10,
            self::Berries, self::Mushroom, self::Flint, self::Hide => 30,
            self::RawMeat, self::CookedMeat, self::WoodWall, self::WoodRoof, self::StoneWall, self::OldNotes, self::RelicShard => 20,
            self::Torch, self::Bandage, self::HealingPotion, self::ManaPotion => 10,
            self::Campfire, self::Chest, self::WoodDoor => 5,
            self::Workbench, self::SleepingBag => 2,
            default => 1,
        };
    }

    /**
     * Uses before it breaks; null for things that do not wear out.
     */
    public function durability(): ?int
    {
        return match ($this) {
            self::WoodSword => 40,
            self::StoneAxe, self::StonePickaxe => 60,
            self::StoneSword, self::Shovel, self::LeatherHelmet, self::LeatherBoots => 80,
            self::LeatherJacket => 120,
            self::Dagger => 150,
            self::IronAxe, self::IronPickaxe, self::Staff => 200,
            self::IronHelmet, self::IronBoots => 220,
            self::IronSword => 250,
            self::WarHammer => 260,
            self::IronChestplate => 320,
            default => null,
        };
    }

    /**
     * Where a piece of armour is worn; null for anything else.
     */
    public function armorSlot(): ?string
    {
        return match ($this) {
            self::LeatherHelmet, self::IronHelmet => 'head',
            self::LeatherJacket, self::IronChestplate => 'body',
            self::LeatherBoots, self::IronBoots => 'feet',
            default => null,
        };
    }
}
