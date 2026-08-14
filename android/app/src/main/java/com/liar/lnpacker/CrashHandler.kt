package com.liar.lnpacker

import android.content.Context
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Writes uncaught native exceptions (including JavaScript fatal errors that React
 * Native re-throws on the UI thread) to the app's private files directory and to
 * the app's external files directory, so a crash log is retrievable without logcat.
 */
class CrashHandler(private val context: Context) : Thread.UncaughtExceptionHandler {

  private val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()

  override fun uncaughtException(thread: Thread, throwable: Throwable) {
    try {
      val text = buildString {
        appendLine()
        appendLine("===== ${SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())} [NATIVE] ${thread.name} =====")
        appendLine(Log.getStackTraceString(throwable))
      }
      appendLog(File(context.filesDir, "crash.log"), text)
      context.getExternalFilesDir(null)?.let { appendLog(File(it, "crash.log"), text) }
    } catch (_: Exception) {
    }
    defaultHandler?.uncaughtException(thread, throwable)
  }

  private fun appendLog(file: File, text: String) {
    try {
      file.appendText(text)
    } catch (_: Exception) {
    }
  }
}
