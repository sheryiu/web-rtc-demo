import { NgClass } from '@angular/common';
import { Component, inject } from '@angular/core';
import { PieceSymbol } from 'chess.js';
import { GameControllerService, GameState } from '../../game-controller.service';

@Component({
  selector: 'app-in-game-layer',
  standalone: true,
  imports: [
    NgClass,
  ],
  templateUrl: `./in-game-layer.component.html`
})
export class InGameLayerComponent {
  private gameController = inject(GameControllerService);
  gameState = this.gameController.state.asReadonly();
  isInCheck = this.gameController.isInCheck.asReadonly();
  colorToMove = this.gameController.colorToMove.asReadonly();

  gameStates = GameState;

  onChoosePromotion(piece: PieceSymbol) {
    this.gameController.promote(piece)
  }

  onSetCamera(use2D: boolean) {
    this.gameController.changeCameraAngle(use2D);
  }
}
