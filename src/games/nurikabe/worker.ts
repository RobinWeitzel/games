/// <reference lib="webworker" />
import { createRng } from '../../core/random';
import { servePuzzles } from '../../core/puzzleSource';
import { Difficulty, generate } from './engine';

servePuzzles((mode: Difficulty, seed: number) => generate(mode, createRng(seed)));
