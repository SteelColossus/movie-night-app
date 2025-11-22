import { test, expect } from '@playwright/test';

test('creates and finishes a movie night', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Movie Night App');

    await page.locator('#username').fill('User 1');
    await expect(page).toHaveScreenshot('username-view.png');
    await page.locator('#username').press('Enter');
    await expect(page.locator('#usernameIndicator')).toHaveText('User 1');

    await page.selectOption('#votingSystem', { label: 'Multi Vote' });
    await page.selectOption('#numSuggestions', { label: '1' });

    await page.locator('#nightName').fill('My Movie Night');
    await expect(page).toHaveScreenshot('host-view.png');
    await page.locator('#nightName').press('Enter');
    await expect(page.locator('#movieNightTitle')).toHaveText('My Movie Night');

    await page.locator('#suggestion').fill('Harry Potter');
    await expect(page).toHaveScreenshot('search-view.png');
    await page.locator('#suggestion').press('Enter');

    const movieRow = page.locator(
        '//table[@id="suggestionTable"]//tr[./td[text() = "Harry Potter and the Goblet of Fire"]]'
    );
    await expect(movieRow.locator('td:text("2005")')).toBeVisible();
    await expect(page).toHaveScreenshot('suggestions-view.png');
    await movieRow.locator('input[type="button"]').click();

    await expect(
        page.locator('//table[@id="movieTable"]//tr/td[text() = "2 hours 37 mins"]')
    ).toBeVisible();
    await expect(page).toHaveScreenshot('vote-view.png');

    const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        page.getByRole('cell', { name: 'Harry Potter and the Goblet of Fire' }).click()
    ]);

    await newPage.waitForLoadState('domcontentloaded');
    await expect(newPage.getByRole('heading')).toHaveText(
        'Harry Potter and the Goblet of Fire (2005)'
    );
    await expect(newPage).toHaveScreenshot('movie-view.png');

    await newPage.close();
    await page.bringToFront();

    await page.locator('#closeSuggestionsButton').click();

    const voteButton = page.locator('table#voteTable td > input[type="button"][value="Vote!"]');
    const voteText = page.locator('table#voteTable td[votes-for]');

    async function checkVoting(val) {
        await voteButton.click();
        await expect(voteText).toHaveText(val);
    }
    await checkVoting('1');
    await expect(page).toHaveScreenshot('after-voting.png');
    await checkVoting('0');
    await checkVoting('1');
    await expect(page).toHaveScreenshot('after-voting.png');
    await page.locator('#closeVotingButton').click();

    await expect(page.locator('#winner')).toContainText('Harry Potter and the Goblet of Fire');
    await expect(page.locator('#voteChart')).toBeVisible();
    await expect(page).toHaveScreenshot('results-view.png');
    await page.locator('#endButton').click();

    await expect(page.locator('#nightName')).toBeVisible();
    await expect(page.locator('#movieNightTitle')).toBeHidden();
});
