import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import notificationReducer, { addToast } from '@/store/slices/notificationSlice'
import Toast from './Toast'

const createTestStore = () => {
  return configureStore({
    reducer: {
      notification: notificationReducer,
    },
  })
}

describe('Toast', () => {
  it('renders success toast', () => {
    const store = createTestStore()
    store.dispatch(addToast({ message: 'Success message', type: 'success' }))

    render(
      <Provider store={store}>
        <Toast />
      </Provider>
    )

    expect(screen.getByText('Success message')).toBeInTheDocument()
  })

  it('renders error toast', () => {
    const store = createTestStore()
    store.dispatch(addToast({ message: 'Error message', type: 'error' }))

    render(
      <Provider store={store}>
        <Toast />
      </Provider>
    )

    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('removes toast on close button click', () => {
    const store = createTestStore()
    store.dispatch(addToast({ message: 'Test message', type: 'info' }))

    render(
      <Provider store={store}>
        <Toast />
      </Provider>
    )

    const closeButton = screen.getByRole('button')
    fireEvent.click(closeButton)

    expect(screen.queryByText('Test message')).not.toBeInTheDocument()
  })

  it('auto-dismisses toast after duration', async () => {
    const store = createTestStore()
    store.dispatch(
      addToast({ message: 'Auto dismiss', type: 'info', duration: 100 })
    )

    render(
      <Provider store={store}>
        <Toast />
      </Provider>
    )

    expect(screen.getByText('Auto dismiss')).toBeInTheDocument()

    await waitFor(
      () => {
        expect(screen.queryByText('Auto dismiss')).not.toBeInTheDocument()
      },
      { timeout: 200 }
    )
  })
})
