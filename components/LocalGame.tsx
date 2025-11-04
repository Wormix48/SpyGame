import React, { useState, useCallback, useMemo } from 'react';
import { GameState, Player, Question, Answer, Vote, QuestionSource, QuestionType } from '../types';
import { LocalSetupScreen } from './LocalSetupScreen';
import { PassDeviceScreen } from './PassDeviceScreen';
import { RoleRevealScreen } from './RoleRevealScreen';
import { AnsweringScreen } from './AnsweringScreen';
import { ResultsDiscussionScreen } from './ResultsDiscussionScreen';
import { VoteRevealScreen } from './VoteRevealScreen';
import { GameOverScreen } from './GameOverScreen';
import { LoadingScreen } from './LoadingScreen';
import { generateId, checkWinConditions, generateNewQuestion } from '../utils';
interface LocalGameProps {
    onExit: () => void;
}
interface PlayerProfile {
  id: string;
  name: string;
  avatar: string | null;
}
export const LocalGame: React.FC<LocalGameProps> = ({ onExit }) => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [localTurnPhase, setLocalTurnPhase] = useState<'PASS_DEVICE' | 'ACTION' | 'DISCUSSION'>('PASS_DEVICE');
    const [localPlayerIndex, setLocalPlayerIndex] = useState(0);
    const [localVotes, setLocalVotes] = useState<Vote[]>([]);
    const [aiError, setAiError] = useState<string | null>(null);
    const playerList = useMemo(() => gameState ? Object.values(gameState.players) : [], [gameState]);
    const activePlayers = useMemo(() => playerList.filter(p => !p.isEliminated), [playerList]);
    const startNewRound = useCallback(async (currentState: GameState) => {
        setIsGenerating(true);
        setAiError(null);
        const { newQuestion, usedQuestionIds, usedQuestionTexts, error } = await generateNewQuestion(currentState);
        if (error) {
            setAiError(error);
        }
        let finalState = { ...currentState };
        if (newQuestion) {
            let questionWithDynamicAnswers = { ...newQuestion };
            if (questionWithDynamicAnswers.type === 'PLAYERS') {
                questionWithDynamicAnswers.answers = Object.values(finalState.players).filter(p => !p.isEliminated).map(p => p.name);
            }
            finalState = {
                ...finalState,
                currentQuestion: questionWithDynamicAnswers,
                usedQuestionIds,
                usedQuestionTexts,
                answers: [],
                votes: [],
                lastEliminated: null,
                gamePhase: 'ANSWERING',
                answerTimerEnd: null,
            };
        } else {
            finalState = { ...finalState, winner: 'PLAYERS', gamePhase: 'GAME_OVER' }; // End game if no questions at all
        }
        setIsGenerating(false);
        setGameState(finalState);
        setLocalPlayerIndex(0);
        setLocalTurnPhase('PASS_DEVICE');
    }, []);
    const startVotingPhase = useCallback((state: GameState) => {
        const newState: GameState = { ...state, gamePhase: 'RESULTS_DISCUSSION', votes: [], voteTimerEnd: null };
        setLocalPlayerIndex(0);
        setLocalTurnPhase(newState.votingEnabled ? 'DISCUSSION' : 'ACTION');
        setLocalVotes([]);
        setGameState(newState);
    }, []);
    const handleLocalGameStart = (playerProfiles: PlayerProfile[], spyCount: number, voting: boolean, source: QuestionSource, familyMode: boolean, roundLimit: boolean, showQuestionToSpy: boolean, anonymousVoting: boolean) => {
        const initialPlayers: Player[] = playerProfiles.map((profile) => ({
            id: profile.id, name: profile.name, avatar: profile.avatar, isSpy: false, isEliminated: false, isHost: false,
        }));
        // Fisher-Yates shuffle to ensure true randomness
        const playersToShuffle = [...initialPlayers];
        for (let i = playersToShuffle.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playersToShuffle[i], playersToShuffle[j]] = [playersToShuffle[j], playersToShuffle[i]];
        }
        const spyIds = new Set(playersToShuffle.slice(0, spyCount).map(p => p.id));
        const finalPlayers = initialPlayers.map(p => ({
            ...p,
            isSpy: spyIds.has(p.id)
        }));
        const playersObject = finalPlayers.reduce((acc, p) => {
            acc[p.id] = p;
            return acc;
        }, {} as Record<string, Player>);
        setGameState({
            roomId: null, hostId: null, players: playersObject, initialSpyCount: spyCount, votingEnabled: voting,
            questionSource: source, familyFriendly: familyMode, noTimer: true, roundLimit, showQuestionToSpy, anonymousVoting, gamePhase: 'ROLE_REVEAL', round: 1,
            usedQuestionIds: [], usedQuestionTexts: [], currentQuestion: null, answers: [], votes: [], chatMessages: [],
            lastEliminated: null, winner: null, answerTimerEnd: null, voteTimerEnd: null,
        });
        setLocalPlayerIndex(0);
        setLocalTurnPhase('PASS_DEVICE');
    };
    const handleRolesRevealed = useCallback(async () => {
        if (gameState) {
            await startNewRound(gameState);
        }
    }, [gameState, startNewRound]);
    const handleLocalRoleRevealContinue = () => {
        const nextIndex = localPlayerIndex + 1;
        if (nextIndex >= playerList.length) {
            handleRolesRevealed();
        } else {
            setLocalPlayerIndex(nextIndex);
            setLocalTurnPhase('PASS_DEVICE');
        }
    };
    const handleAnswerSubmit = useCallback((answer: string) => {
        if (gameState) {
            const currentPlayer = activePlayers[localPlayerIndex];
            const newAnswers = [...gameState.answers, { playerId: currentPlayer.id, answer }];
            const newGameState = { ...gameState, answers: newAnswers };
            const nextIndex = localPlayerIndex + 1;
            if (nextIndex >= activePlayers.length) {
                startVotingPhase(newGameState);
            } else {
                setGameState(newGameState);
                setLocalPlayerIndex(nextIndex);
                setLocalTurnPhase('PASS_DEVICE');
            }
        }
    }, [gameState, localPlayerIndex, activePlayers, startVotingPhase]);
    const handleLocalVotingFinished = useCallback((votes: Vote[]) => {
        if (!gameState) return;
        const requiredVotes = Math.ceil(activePlayers.length / 2);
        const actualVotes = votes.filter(v => v.votedForId !== null);
        const voteCounts: Record<string, number> = {};
        actualVotes.forEach(vote => { voteCounts[vote.votedForId!] = (voteCounts[vote.votedForId!] || 0) + 1; });
        let maxVotes = 0, playersToEliminate: string[] = [];
        for (const playerId in voteCounts) {
            if (voteCounts[playerId] > maxVotes) {
                maxVotes = voteCounts[playerId];
                playersToEliminate = [playerId];
            } else if (voteCounts[playerId] === maxVotes) {
                playersToEliminate.push(playerId);
            }
        }
        let eliminatedPlayer: Player | null = null;
        let newPlayers = { ...gameState.players };
        if (playersToEliminate.length === 1 && maxVotes >= requiredVotes) {
            const eliminatedId = playersToEliminate[0];
            newPlayers[eliminatedId] = { ...newPlayers[eliminatedId], isEliminated: true };
            eliminatedPlayer = gameState.players[eliminatedId] || null;
        }
        setGameState({ ...gameState, votes, players: newPlayers, lastEliminated: eliminatedPlayer, gamePhase: 'VOTE_REVEAL' });
    }, [gameState, activePlayers]);
    const handleLocalVoteSubmit = useCallback((vote: Vote) => {
        if (!gameState) return;
        const newLocalVotes = [...localVotes, vote];
        setLocalVotes(newLocalVotes);
        const nextIndex = localPlayerIndex + 1;
        if (nextIndex >= activePlayers.length) {
            // Finished voting, now tally
            handleLocalVotingFinished(newLocalVotes);
        } else {
            // Next player
            setLocalPlayerIndex(nextIndex);
            setLocalTurnPhase('PASS_DEVICE');
        }
    }, [gameState, localPlayerIndex, activePlayers, localVotes, handleLocalVotingFinished]);
    const handleVoteRevealFinished = useCallback(async () => {
        if (!gameState) return;
        let winner = checkWinConditions(Object.values(gameState.players));
        const initialPlayerCount = playerList.length;
        if (!winner && gameState.roundLimit && gameState.round >= initialPlayerCount - 1) {
            winner = 'SPIES';
        }
        if (winner) {
            setGameState({ ...gameState, winner: winner, gamePhase: 'GAME_OVER' });
        } else {
            await startNewRound({ ...gameState, round: gameState.round + 1 });
        }
    }, [gameState, startNewRound, playerList.length]);
    const handleReplay = useCallback(() => {
        // This will unmount the game and mount the setup screen, 
        // which will load the last used player list from localStorage.
        setGameState(null);
    }, []);
    if (isGenerating) {
        const title = gameState?.questionSource === 'ai' ? "ИИ генерирует вопрос..." : "Подбираем вопрос...";
        const description = gameState?.questionSource === 'ai' ? "Это может занять несколько секунд." : undefined;
        return <LoadingScreen title={title} description={description} />;
    }
    if (!gameState) {
        return <LocalSetupScreen onGameStart={handleLocalGameStart} />;
    }
    const currentPlayer = activePlayers[localPlayerIndex];
    const screenContent = () => {
        switch (gameState.gamePhase) {
            case 'SETUP': return <LocalSetupScreen onGameStart={handleLocalGameStart} />;
            case 'ROLE_REVEAL':
                if (localTurnPhase === 'PASS_DEVICE') return <PassDeviceScreen nextPlayerName={playerList[localPlayerIndex].name} onReady={() => setLocalTurnPhase('ACTION')} title="Узнай свою роль" instruction="Передайте устройство следующему игроку." />;
                return <RoleRevealScreen player={playerList[localPlayerIndex]} onContinue={handleLocalRoleRevealContinue} isHost={false} isLocalMode={true} />;
            case 'ANSWERING':
                if (localTurnPhase === 'PASS_DEVICE') return <PassDeviceScreen nextPlayerName={currentPlayer.name} onReady={() => setLocalTurnPhase('ACTION')} title={`Ход игрока ${currentPlayer.name}`} instruction="Не подсматривайте!" />;
                return <AnsweringScreen player={currentPlayer} question={gameState.currentQuestion!} onSubmit={handleAnswerSubmit} timerEnd={null} players={[]} answers={[]} isLocalMode={true} showQuestionToSpy={gameState.showQuestionToSpy} />;
            case 'RESULTS_DISCUSSION':
                if (gameState.votingEnabled) { // Sequential Voting
                    if (localTurnPhase === 'DISCUSSION') {
                        return <ResultsDiscussionScreen
                            question={gameState.currentQuestion!}
                            players={playerList}
                            answers={gameState.answers}
                            isHost={false}
                            isLocalMode={true}
                            isDiscussionOnly={true}
                            onProceedToVote={() => setLocalTurnPhase('PASS_DEVICE')}
                            showQuestionToSpy={gameState.showQuestionToSpy}
                        />;
                    }
                    if (localTurnPhase === 'PASS_DEVICE') return <PassDeviceScreen nextPlayerName={currentPlayer.name} onReady={() => setLocalTurnPhase('ACTION')} title={`Голосование: ${currentPlayer.name}`} instruction="Не подсматривайте!" />;
                    return <ResultsDiscussionScreen 
                        question={gameState.currentQuestion!} 
                        players={playerList} 
                        answers={gameState.answers}
                        isHost={false} 
                        isLocalMode={true} 
                        localSequentialVoter={currentPlayer}
                        onFinishLocalSequentialVote={handleLocalVoteSubmit}
                        showQuestionToSpy={gameState.showQuestionToSpy}
                    />;
                } else { // Host-led Voting
                     return <ResultsDiscussionScreen
                        question={gameState.currentQuestion!}
                        players={playerList}
                        answers={gameState.answers}
                        isHost={false}
                        isLocalMode={true}
                        onFinishLocalVoting={handleLocalVotingFinished}
                        showQuestionToSpy={gameState.showQuestionToSpy}
                    />;
                }
            case 'VOTE_REVEAL': return <VoteRevealScreen eliminatedPlayer={gameState.lastEliminated} votes={gameState.votes} players={playerList} onContinue={handleVoteRevealFinished} isHost={false} isLocalMode={true} anonymousVoting={gameState.anonymousVoting} />;
            case 'GAME_OVER': return <GameOverScreen winner={gameState.winner!} players={playerList} onNewGame={onExit} onReplay={handleReplay} isHost={false} isLocalMode={true} />;
            default: return <div>Загрузка локальной игры...</div>;
        }
    }
    return (
        <>
            {aiError && (
                <div className="bg-yellow-900/50 border border-yellow-500 text-yellow-300 px-4 py-2 rounded-lg text-center mb-4 animate-fade-in" role="alert">
                    {aiError}
                </div>
            )}
            {screenContent()}
        </>
    );
};
