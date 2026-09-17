// ==UserScript==
// @name         Umime Turtle Graphics Solver (Debug)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Auto-solve with correct property access
// @match        https://www.umimeinformatiku.cz/zelvi-grafika*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let solverActive = false;
    let checkTimer = null;

    function log(msg, data) {
        console.log('[TurtleSolver] ' + msg, data || '');
    }

    // Initialize
    log('Script loaded, waiting for page...');

    const waitForItems = setInterval(() => {
        if (typeof items !== 'undefined' && items.length > 0 && typeof offset !== 'undefined' && offset >= 0) {
            clearInterval(waitForItems);
            log('Items loaded, count:', items.length);
            log('Current offset:', offset);
            initSolver();
        }
    }, 1000);

    function initSolver() {
        createUI();

        const originalNextItem = window.nextItem;
        window.nextItem = function(...args) {
            log('nextItem called');
            const result = originalNextItem.apply(this, args);
            if (solverActive) {
                setTimeout(() => {
                    solveCurrentExercise();
                }, 2500);
            }
            return result;
        };

        log('Solver initialized. Click Start to begin.');
    }

    function createUI() {
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 99999;
            background: rgba(255,255,255,0.95);
            border: 2px solid #333;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            min-width: 250px;
        `;

        panel.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 10px; text-align: center; font-size: 16px;">
                Aura Solver
            </div>
            <button id="turtle-toggle" style="
                width: 100%;
                padding: 10px;
                background: #28a745;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                margin-bottom: 8px;
            ">▶ START</button>
            <div id="turtle-status" style="font-size: 12px; color: #666; text-align: center; margin-bottom: 8px;">
                Ready
            </div>
            <div id="turtle-debug" style="font-size: 10px; color: #999; max-height: 100px; overflow-y: auto; border-top: 1px solid #ddd; padding-top: 5px;">
                Waiting...
            </div>
        `;

        document.body.appendChild(panel);
        document.getElementById('turtle-toggle').onclick = toggleSolver;
    }

    function updateStatus(text) {
        const el = document.getElementById('turtle-status');
        if (el) el.textContent = text;
        log('Status:', text);
    }

    function addDebug(text) {
        const el = document.getElementById('turtle-debug');
        if (el) {
            el.innerHTML += text + '<br>';
            el.scrollTop = el.scrollHeight;
        }
    }

    function toggleSolver() {
        solverActive = !solverActive;
        const btn = document.getElementById('turtle-toggle');

        if (solverActive) {
            btn.textContent = '⏹ STOP';
            btn.style.background = '#dc3545';
            document.getElementById('turtle-debug').innerHTML = '';
            solveCurrentExercise();
        } else {
            btn.textContent = '▶ START';
            btn.style.background = '#28a745';
            updateStatus('Paused');
            if (checkTimer) clearInterval(checkTimer);
        }
    }

    function solveCurrentExercise() {
        if (!solverActive) return;

        if (!items || offset < 0 || !items[offset]) {
            updateStatus('Waiting for exercise...');
            setTimeout(solveCurrentExercise, 1000);
            return;
        }

        const currentItem = items[offset];
        log('Current item ID:', currentItem.id);
        addDebug('Item: ' + currentItem.id);

        // Check multiple possible locations for the solution
        let solution = null;
        let solutionPath = '';

        // Direct solution property
        if (currentItem.solution) {
            solution = currentItem.solution;
            solutionPath = 'item.solution';
            log('Found solution in:', solutionPath);
            addDebug('Found in: ' + solutionPath);
            addDebug('Type: ' + typeof solution);
            addDebug('Has blocks: ' + (solution.blocks ? 'yes' : 'no'));
        }
        // In item.item.solution (nested)
        else if (currentItem.item?.solution) {
            solution = currentItem.item.solution;
            solutionPath = 'item.item.solution';
            log('Found solution in:', solutionPath);
            addDebug('Found in: ' + solutionPath);
        }
        // In params.solution (old location)
        else if (currentItem.params?.solution) {
            solution = currentItem.params.solution;
            solutionPath = 'item.params.solution';
            log('Found solution in:', solutionPath);
            addDebug('Found in: ' + solutionPath);
        }

        if (!solution) {
            updateStatus('❌ No solution found!');
            addDebug('Available props: ' + Object.keys(currentItem).join(', '));
            if (currentItem.item) {
                addDebug('Item props: ' + Object.keys(currentItem.item).join(', '));
            }
            return;
        }

        updateStatus('Loading solution from ' + solutionPath + '...');

        try {
            if (typeof demoWorkspace === 'undefined') {
                updateStatus('Error: Blockly not ready');
                return;
            }

            // Skip intro
            if (typeof introPlaying !== 'undefined') {
                window.introPlaying = false;
            }

            // Clear workspace
            demoWorkspace.clear();

            // Load solution - it might be a string or object
            let solutionData = solution;
            if (typeof solution === 'string') {
                try {
                    solutionData = JSON.parse(solution);
                } catch(e) {
                    addDebug('Solution is string but not JSON');
                }
            }

            // Try to load using Blockly serialization
            Blockly.serialization.workspaces.load(solutionData, demoWorkspace);
            addDebug('Solution loaded into workspace');

            // Run it
            setTimeout(() => {
                updateStatus('Running...');
                if (typeof runTurtle === 'function') {
                    runTurtle(false);
                    waitForCompletion();
                }
            }, 500);

        } catch (e) {
            console.error('Error:', e);
            updateStatus('Error: ' + e.message);
            addDebug('Error: ' + e.message);
        }
    }

    function waitForCompletion() {
        if (checkTimer) clearInterval(checkTimer);

        let attempts = 0;
        checkTimer = setInterval(() => {
            attempts++;
            if (!solverActive) {
                clearInterval(checkTimer);
                return;
            }

            if (window.finished === 1) {
                clearInterval(checkTimer);
                updateStatus('✓ Complete!');
                addDebug('Finished! Clicking next...');

                setTimeout(() => {
                    const nextBtn = document.getElementById('next');
                    if (nextBtn && nextBtn.offsetParent !== null) {
                        nextBtn.click();
                    }
                }, 1000);
            } else if (attempts > 60) {
                clearInterval(checkTimer);
                updateStatus('Timeout');
                addDebug('Timeout waiting for completion');
            }
        }, 500);
    }

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
            if (document.activeElement.tagName !== 'INPUT') {
                toggleSolver();
            }
        }
    });
})();
