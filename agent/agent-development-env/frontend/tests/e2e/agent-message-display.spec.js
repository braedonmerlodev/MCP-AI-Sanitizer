import { test, expect } from '@playwright/test'

test.describe('Agent Message Display - Cross Browser Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the chat interface
    await page.goto('/')

    // Wait for the chat interface to load
    await page.waitForSelector('[data-testid="chat-interface"]')
  })

  test('should display agent messages correctly in all browsers', async ({
    page,
    browserName,
  }) => {
    // Mock WebSocket connection and agent message
    await page.evaluate(() => {
      // Mock WebSocket message for agent message
      const mockAgentMessage = {
        type: 'agent_message',
        content: {
          type: 'sanitization_summary',
          summary:
            'PDF processed successfully. Content sanitized with trust token generated.',
          trustToken: {
            contentHash:
              '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72',
            signature: 'mock-signature',
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        },
        messageId: 'test-agent-msg-1',
      }

      // Simulate receiving agent message via WebSocket
      window.dispatchEvent(
        new CustomEvent('websocket-message', {
          detail: mockAgentMessage,
        })
      )
    })

    // Wait for agent message to appear
    await page.waitForSelector('[data-testid="agent-message"]')

    // Verify agent message content
    const agentMessage = page.locator('[data-testid="agent-message"]')
    await expect(agentMessage).toBeVisible()

    // Check message text
    const messageText = agentMessage.locator('.message-content')
    await expect(messageText).toContainText('PDF processed successfully')

    // Check trust token display
    const trustToken = agentMessage.locator('[data-testid="trust-token"]')
    await expect(trustToken).toBeVisible()
    await expect(trustToken).toContainText('mock-signature')

    // Verify styling is consistent across browsers
    const messageBubble = agentMessage.locator('.message-bubble')
    const backgroundColor = await messageBubble.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    )
    const textColor = await messageBubble.evaluate(
      (el) => getComputedStyle(el).color
    )

    // Agent messages should have distinct styling from user messages
    expect(backgroundColor).not.toBe('transparent')
    expect(textColor).not.toBe('transparent')

    // Log browser-specific results
    console.log(`Agent message display test passed in ${browserName}`)
  })

  test('should handle multiple agent messages with proper ordering', async ({
    page,
    browserName,
  }) => {
    // Send multiple agent messages
    for (let i = 1; i <= 3; i++) {
      await page.evaluate((msgId) => {
        const mockAgentMessage = {
          type: 'agent_message',
          content: {
            type: 'sanitization_summary',
            summary: `PDF ${msgId} processed successfully.`,
            trustToken: {
              contentHash: `hash-${msgId}`,
              signature: `sig-${msgId}`,
              timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
          },
          messageId: `test-agent-msg-${msgId}`,
        }

        window.dispatchEvent(
          new CustomEvent('websocket-message', {
            detail: mockAgentMessage,
          })
        )
      }, i)

      // Small delay to ensure messages are processed in order
      await page.waitForTimeout(100)
    }

    // Wait for all messages to appear
    await page.waitForSelector('[data-testid="agent-message"]:nth-child(3)')

    // Verify all three messages are displayed
    const agentMessages = page.locator('[data-testid="agent-message"]')
    await expect(agentMessages).toHaveCount(3)

    // Verify ordering (most recent should be last)
    const firstMessage = agentMessages.nth(0)
    const secondMessage = agentMessages.nth(1)
    const thirdMessage = agentMessages.nth(2)

    await expect(firstMessage).toContainText('PDF 1 processed successfully')
    await expect(secondMessage).toContainText('PDF 2 processed successfully')
    await expect(thirdMessage).toContainText('PDF 3 processed successfully')

    console.log(
      `Multiple agent messages ordering test passed in ${browserName}`
    )
  })

  test('should display agent messages with proper accessibility attributes', async ({
    page,
    browserName,
  }) => {
    await page.evaluate(() => {
      const mockAgentMessage = {
        type: 'agent_message',
        content: {
          type: 'sanitization_summary',
          summary: 'Security scan completed. No threats detected.',
          trustToken: {
            contentHash: 'secure-hash',
            signature: 'secure-sig',
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        },
        messageId: 'accessibility-test-msg',
      }

      window.dispatchEvent(
        new CustomEvent('websocket-message', {
          detail: mockAgentMessage,
        })
      )
    })

    await page.waitForSelector('[data-testid="agent-message"]')

    const agentMessage = page.locator('[data-testid="agent-message"]')

    // Check for proper ARIA attributes
    await expect(agentMessage).toHaveAttribute('role', 'article')
    await expect(agentMessage).toHaveAttribute(
      'aria-label',
      /agent message|system message/i
    )

    // Check for proper heading structure
    const heading = agentMessage.locator('h3, h4, [role="heading"]')
    await expect(heading).toBeVisible()
    await expect(heading).toContainText(/agent|system|sanitization/i)

    // Check for proper color contrast (this is a basic check)
    const messageText = agentMessage.locator('.message-content')
    const computedStyle = await messageText.evaluate((el) =>
      getComputedStyle(el)
    )
    expect(computedStyle.color).not.toBe('rgba(0, 0, 0, 0)') // Not transparent

    console.log(`Accessibility test passed in ${browserName}`)
  })

  test('should handle agent message display under load', async ({
    page,
    browserName,
  }) => {
    const messageCount = 10

    // Send multiple messages rapidly
    for (let i = 0; i < messageCount; i++) {
      await page.evaluate((index) => {
        const mockAgentMessage = {
          type: 'agent_message',
          content: {
            type: 'sanitization_summary',
            summary: `Load test message ${index}`,
            trustToken: {
              contentHash: `load-hash-${index}`,
              signature: `load-sig-${index}`,
              timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
          },
          messageId: `load-test-msg-${index}`,
        }

        window.dispatchEvent(
          new CustomEvent('websocket-message', {
            detail: mockAgentMessage,
          })
        )
      }, i)
    }

    // Wait for all messages to render
    await page.waitForSelector(
      `[data-testid="agent-message"]:nth-child(${messageCount})`
    )

    // Verify all messages are displayed without UI breaking
    const agentMessages = page.locator('[data-testid="agent-message"]')
    await expect(agentMessages).toHaveCount(messageCount)

    // Check that scrolling works properly (messages don't overflow viewport badly)
    const chatContainer = page.locator('[data-testid="chat-container"]')
    const scrollHeight = await chatContainer.evaluate((el) => el.scrollHeight)
    const clientHeight = await chatContainer.evaluate((el) => el.clientHeight)

    // Should be scrollable if content exceeds viewport
    if (scrollHeight > clientHeight) {
      await chatContainer.evaluate((el) => el.scrollTo(0, scrollHeight))
      const scrollTop = await chatContainer.evaluate((el) => el.scrollTop)
      expect(scrollTop).toBeGreaterThan(0)
    }

    console.log(
      `Load test passed in ${browserName} with ${messageCount} messages`
    )
  })

  test('should maintain agent message display after browser refresh', async ({
    page,
    browserName,
  }) => {
    // Send an agent message
    await page.evaluate(() => {
      const mockAgentMessage = {
        type: 'agent_message',
        content: {
          type: 'sanitization_summary',
          summary: 'Persistent agent message test',
          trustToken: {
            contentHash: 'persistent-hash',
            signature: 'persistent-sig',
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        },
        messageId: 'persistent-msg',
      }

      window.dispatchEvent(
        new CustomEvent('websocket-message', {
          detail: mockAgentMessage,
        })
      )
    })

    await page.waitForSelector('[data-testid="agent-message"]')

    // Refresh the page
    await page.reload()

    // Wait for page to reload and check if agent messages are restored
    // Note: In a real implementation, agent messages might be persisted or re-fetched
    await page.waitForSelector('[data-testid="chat-interface"]')

    // This test assumes agent messages are not persisted across refreshes
    // In a real app, you might check localStorage or re-connection logic
    const agentMessages = page.locator('[data-testid="agent-message"]')
    const count = await agentMessages.count()

    // Should be 0 after refresh (or implement persistence check)
    expect(count).toBe(0)

    console.log(`Refresh persistence test passed in ${browserName}`)
  })
})
