
document.addEventListener("DOMContentLoaded", function () {

    const main = document.querySelector("main");
    const panels = Array.from(main.querySelectorAll(".panel"));

    // Keep the first panel for the simulator navigation.
    const navigationPanel = panels[0];

    // All remaining panels become individual learning steps.
    const steps = panels.slice(1);

    let currentStep = 0;
    let completedSteps = [];

    const controller = document.createElement("section");
    controller.className = "panel";
    controller.id = "learningController";

    controller.innerHTML = `
        <h2>🎓 Interactive Learning Journey</h2>

        <p id="stepCounter"></p>

        <div style="
            width:100%;
            height:10px;
            background:#ddd;
            border-radius:20px;
            overflow:hidden;
            margin:15px 0;
        ">
            <div id="progressBar" style="
                width:0%;
                height:100%;
                background:#16a34a;
                transition:width 0.3s;
            "></div>
        </div>

        <p id="completionStatus"></p>

        <label for="stepSelector"><strong>Jump to a step:</strong></label>

        <select id="stepSelector" style="
            width:100%;
            padding:10px;
            margin:10px 0 20px;
        "></select>

        <div style="
            display:flex;
            flex-wrap:wrap;
            gap:10px;
            margin-top:20px;
        ">
            <button id="previousStep">← Previous</button>
            <button id="completeStep">✓ Mark Complete</button>
            <button id="nextStep">Next →</button>
        </div>

        <p id="stepMessage" aria-live="polite"></p>
    `;

    navigationPanel.after(controller);

    // Hide the original theory sections.
    steps.forEach(step => {
        step.style.display = "none";
    });

    const counter = document.getElementById("stepCounter");
    const progressBar = document.getElementById("progressBar");
    const status = document.getElementById("completionStatus");
    const selector = document.getElementById("stepSelector");
    const previousButton = document.getElementById("previousStep");
    const completeButton = document.getElementById("completeStep");
    const nextButton = document.getElementById("nextStep");
    const message = document.getElementById("stepMessage");

    // Create step choices.
    steps.forEach((step, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent =
            "Step " + (index + 1) + ": " +
            step.querySelector("h2").textContent.replace(/^\d+\.\s*/, "");

        selector.appendChild(option);
    });

    function renderStep() {

        // Show only the current step.
        steps.forEach((step, index) => {
            step.style.display =
                index === currentStep ? "block" : "none";
        });

        const completed = completedSteps.length;
        const percentage = Math.round(
            (completed / steps.length) * 100
        );

        counter.textContent =
            "Step " + (currentStep + 1) + " of " + steps.length;

        progressBar.style.width = percentage + "%";

        status.textContent =
            completed + " of " + steps.length + " steps completed";

        selector.value = currentStep;

        previousButton.disabled = currentStep === 0;

        completeButton.textContent =
            completedSteps.includes(currentStep)
                ? "✓ Completed"
                : "✓ Mark Complete";

        nextButton.disabled =
            currentStep === steps.length - 1 ||
            !completedSteps.includes(currentStep);

        if (currentStep === steps.length - 1 &&
            completedSteps.length === steps.length) {
            message.textContent =
                "🎉 Congratulations! You completed the learning journey.";
        } else {
            message.textContent = "";
        }
    }

    previousButton.addEventListener("click", function () {
        if (currentStep > 0) {
            currentStep--;
            renderStep();
        }
    });

    completeButton.addEventListener("click", function () {
        if (!completedSteps.includes(currentStep)) {
            completedSteps.push(currentStep);
        }

        renderStep();

        message.textContent =
            "Excellent! You completed this learning step.";
    });

    nextButton.addEventListener("click", function () {
        if (
            currentStep < steps.length - 1 &&
            completedSteps.includes(currentStep)
        ) {
            currentStep++;
            renderStep();
        }
    });

    selector.addEventListener("change", function () {
        const selectedStep = Number(selector.value);

        // Allow revisiting completed steps and the next available step.
        if (
            selectedStep <= Math.max(...completedSteps, 0) + 1 &&
            selectedStep < steps.length
        ) {
            currentStep = selectedStep;
            renderStep();
        } else {
            selector.value = currentStep;
        }
    });

    renderStep();

});
