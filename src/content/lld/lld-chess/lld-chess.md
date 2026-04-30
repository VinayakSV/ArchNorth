# Design Chess Game

## The Core Problem

Model a two-player chess game: the board, pieces with their movement rules, turn management, check/checkmate detection, and game history.

---

## Class Design

```java
class Game {
  Board board;
  Player whitePlayer, blackPlayer;
  Player currentTurn;
  List<Move> moveHistory;
  GameStatus status;
}

class Board { Piece[][] squares = new Piece[8][8]; }

class Player { String name; Color color; }

enum Color { WHITE, BLACK }
enum GameStatus { IN_PROGRESS, CHECK, CHECKMATE, STALEMATE, DRAW }
```

---

## Piece Hierarchy (Polymorphism)

```java
abstract class Piece {
  Color color;
  Position position;
  abstract List<Move> getValidMoves(Board board);
  abstract boolean canMoveTo(Position target, Board board);
}

class King extends Piece {
  public List<Move> getValidMoves(Board board) {
    // One square in any direction, not into check
  }
}

class Queen extends Piece {
  public List<Move> getValidMoves(Board board) {
    // Combines Rook + Bishop moves
  }
}

class Pawn extends Piece {
  public List<Move> getValidMoves(Board board) {
    // Forward 1 (or 2 from start), diagonal capture, en passant
  }
}
// Rook, Bishop, Knight follow same pattern
```

---

## Move Validation Flow

```
1. Player selects source square → get piece
2. Piece.getValidMoves() → list of legal target squares
3. Player selects target → verify it's in the list
4. Execute move: update Board, update piece position
5. Check if opponent's King is now in check
6. If King in check with no valid escapes → CHECKMATE
```

### Check Detection
```java
boolean isKingInCheck(Color kingColor, Board board) {
  Position kingPos = board.findKing(kingColor);
  // Check if any opponent piece can reach the king
  return board.getPiecesOf(opposite(kingColor))
              .stream()
              .anyMatch(p -> p.canMoveTo(kingPos, board));
}
```

---

## Command Pattern for Move History

```java
interface Command { void execute(); void undo(); }

class MoveCommand implements Command {
  Piece piece; Position from, to; Piece captured;

  public void execute() {
    captured = board.getPiece(to);
    board.movePiece(from, to);
  }

  public void undo() {
    board.movePiece(to, from);
    if (captured != null) board.placePiece(captured, to);
  }
}
```

Storing these commands enables undo/redo and full game replay.

---

<div class="callout-interview">
**Q: "How do you model different piece movements?"**

Polymorphism. All pieces extend an abstract `Piece` class and override `getValidMoves()`. Each piece class encapsulates its own movement logic. The `Game` class never checks piece type — it just calls `getValidMoves()` on whatever piece is selected. This is the Open/Closed Principle: adding a new piece type requires only a new class.

**Q: "How do you detect checkmate?"**

First check if the king is in check. If yes, generate all valid moves for every friendly piece. For each move, simulate it, then check if the king is still in check. If no move removes the check, it's checkmate.

**Q: "How would you implement undo?"**

Command Pattern. Each move is a `MoveCommand` with `execute()` and `undo()` methods. Store commands in a stack. Undo pops and reverses the last command, restoring the captured piece and moving the piece back.
</div>
