#import "LNPackerModule.h"
#import <React/RCTUtils.h>
#import <Cocoa/Cocoa.h>

@implementation LNPackerModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_METHOD(pickFolder:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.canChooseFiles = NO;
    panel.canChooseDirectories = YES;
    panel.allowsMultipleSelection = NO;
    panel.prompt = @"选择";
    panel.message = @"选择导出的目标文件夹";
    if ([panel runModal] == NSModalResponseOK) {
      resolve(panel.URL.path);
    } else {
      resolve(nil);
    }
  });
}

RCT_EXPORT_METHOD(writeFiles:(NSArray<NSDictionary *> *)files directory:(NSString *)directory
                  resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSError *error = nil;
    NSInteger written = 0;
    for (NSDictionary *file in files) {
      NSString *name = file[@"name"];
      NSString *base64 = file[@"base64"];
      NSData *data = [[NSData alloc] initWithBase64EncodedString:base64 options:NSDataBase64DecodingIgnoreUnknownCharacters];
      if (!name || !data) {
        continue;
      }
      NSString *path = [directory stringByAppendingPathComponent:name];
      if (![data writeToFile:path options:NSDataWritingAtomic error:&error]) {
        reject(@"EXPORT_ERROR", error.localizedDescription, error);
        return;
      }
      written += 1;
    }
    resolve(@(written));
  });
}

@end
